# Монтаж демо-видео из записи scripts/record-demo.ts.
#
# Что делает:
#  • фон — тёмно-синий, с медленно плывущими пятнами цвета, общий для всего ролика;
#  • телефон — в корпусе с тенью, компьютер — в окне браузера; при вводе текста камера плавно наезжает на поле;
#  • курсор (на компьютере) и касание (на телефоне) рисуются здесь по записанным координатам нажатий;
#  • подписи и заголовки свёрстаны в Chrome шрифтами сайта (scripts/demo-layers.ts), слова проявляются по очереди;
#  • заставка, «как было», главы, финал с QR-кодом; переходы — наплывом;
#  • музыка и звуки нажатий синтезируются здесь же — ни одного чужого трека;
#  • озвучка — нейроголос Microsoft через edge-tts (NARRATION), музыка под голосом плавно приглушается.
#
# Запуск: python scripts/compose-demo.py <папка записи> [--preview 12.5,40,...] [--from 270] [--audio-only] [--voice dmitry|svetlana] [--no-voice] [--no-music]
# --from N — перерисовать только куски после N-й секунды, остальные взять из прошлой сборки.
# --audio-only — пересобрать только звук поверх готового build/video.mp4.
# На выходе два ролика: с озвучкой (голос Microsoft через edge-tts) и только с музыкой, плюс субтитры озвучки .srt.
# Нужны ffmpeg, Pillow, numpy и для озвучки edge-tts (pip install edge-tts; путь можно задать в EDGE_TTS). Кадры рендерятся параллельно кусками, куски склеиваются без перекодирования.
import bisect
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import wave
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, FPS = 1920, 1080, 30
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = (sys.argv[1] if len(sys.argv) > 1 else '').replace('\\', '/').rstrip('/')
BUILD = REC + '/build'
LAYERS = BUILD + '/layers'

SITE = '5-35-126-36.sslip.io'
INK = (242, 245, 251)
GOLD = (240, 180, 41)

def stages_label():
    """«43 этапа» — по числу этапов в журнале процесса, чтобы титры не отставали от него."""
    with open(os.path.join(ROOT, 'docs', 'process', 'JOURNAL.md'), encoding='utf8') as f:
        n = sum(1 for line in f if line.startswith('## Этап '))
    word = 'этап' if n % 10 == 1 and n % 100 != 11 else 'этапа' if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else 'этапов'
    return f'{n} {word}'


# ---------- главы ----------
CHAPTERS = {
    '1-student': ('01', 'Утро студентки', 'Расписание, баллы и рейтинг — с телефона', 'Студентка · телефон'),
    '2-certificate': ('02', 'Справка за минуту', 'Без очереди и без похода в деканат', 'Студентка · телефон'),
    '3-teacher': ('03', 'Преподаватель', 'Балл за срез — студентке сразу', 'Преподаватель · компьютер'),
    '4-dean': ('04', 'Деканат', 'Сводка и объявления группам', 'Деканат · компьютер'),
    '5-student': ('05', 'Студентка', 'Объявление и вопрос в деканат', 'Студентка · телефон'),
    '6-dean-answer': ('06', 'Деканат отвечает', 'Готовые ответы на частые вопросы', 'Деканат · компьютер'),
    '7-student-answer': ('07', 'Ответ пришёл', 'Уведомление вместо похода в деканат', 'Студентка · телефон'),
    '8-a11y': ('08', 'Для слабовидящих', 'Крупный шрифт и контраст — в одно касание', 'Студентка · телефон'),
    '9-security': ('09', 'Безопасность', 'Чужие данные недоступны', 'Другой студент · телефон'),
}
URLS = {'3-teacher': '/staff/courses', '4-dean': '/staff/announcements', '6-dean-answer': '/staff/questions'}

# ---------- озвучка ----------
# Каждая фраза привязана к сцене или к появлению подписи: (якорь, сдвиг в секундах, текст).
# Якоря: intro, problem, outro, chapter:<часть>, part:<часть>, cap:<часть>:<номер подписи>.
# {как показать|как произнести}: в субтитрах «QR-код», голосом — «кью-ар-код».
NARRATION = [
    ('intro', 1.2, '{Деканат 24/7|Деканат двадцать четыре на семь} — личный кабинет студента университета «Меридиан».'),
    ('problem', 0.3, 'Обычно расписание — в чате, баллы — в тетради, справка — через очередь, а на вопрос отвечают: «зайдите завтра».'),
    ('problem', 8.0, 'Здесь всё это — в одном кабинете.'),
    ('cap:1-student:0', 0.15, 'Утро студентки. Она входит с телефона по логину и паролю — как в любом кабинете вуза.'),
    ('cap:1-student:1', 0.15, 'Экран «Сегодня» сразу показывает следующую пару, переносы и новые баллы.'),
    ('cap:1-student:2', 0.1, 'Ниже — ведомость с рейтингом, статусы справок и объявления деканата.'),
    ('cap:1-student:3', 0.15, 'В расписании на неделю — аудитория и преподаватель, а переносы выделены.'),
    ('cap:1-student:4', 0.15, 'В успеваемости — прогноз рейтинга за триместр и что даёт каждый порог.'),
    ('cap:1-student:5', 0.15, 'А место на курсе видно без фамилий и чужих баллов — только диапазоном.'),
    ('chapter:2-certificate', 0.2, 'Справка за минуту. Студентка пишет в «Спроси деканат» своими словами, не разыскивая нужный раздел.'),
    ('cap:2-certificate:1', 0.15, 'Кабинет отвечает по её данным и сразу предлагает готовую форму.'),
    ('cap:2-certificate:2', 0.15, 'Назначение уже выбрано — остаётся нажать одну кнопку.'),
    ('cap:2-certificate:3', 0.15, 'И справка готова: файл с печатью и {QR-кодом|кью-ар-кодом}, без всякой очереди.'),
    ('cap:2-certificate:4', 0.15, 'По этому коду любой проверит подлинность — без входа в кабинет и без лишних данных.'),
    ('chapter:3-teacher', 0.25, 'Преподаватель. В его кабинете — только свои курсы и группы, ничего лишнего.'),
    ('cap:3-teacher:1', -0.3, 'Балл — в одно поле, {Enter|Энтер} — к следующему студенту.'),
    ('cap:3-teacher:2', 0.15, 'Сохранил — и студентка сразу получает уведомление, а рейтинг пересчитан.'),
    ('cap:3-teacher:3', 2.7, 'Отзывы о преподавании анонимны: сводка появляется, только когда наберётся пять ответов.'),
    ('chapter:4-dean', 0.3, 'Деканат. На сводке видно, сколько походов в деканат уже сэкономил кабинет.'),
    ('cap:4-dean:1', 0.2, 'Сотрудник пишет объявление группе — оно сразу появится у студентов на главной и в уведомлениях.'),
    ('part:4-dean', 19.4, 'Без рассылок по чатам и потерянных писем.'),
    ('chapter:5-student', 0.25, 'А у студентки объявление уже на главной — без чатов, почты и пересылок.'),
    ('part:5-student', 8.2, 'Оно же — в уведомлениях: новые появляются сами.'),
    ('cap:5-student:1', 0.15, 'Теперь вопрос, ответа на который в её данных нет: можно ли сдать курсовую позже.'),
    ('part:5-student', 21.6, 'Кабинет не выдумывает ответ и предлагает написать в деканат.'),
    ('part:5-student', 26.5, 'Вопрос уже перенесён в форму — осталось отправить.'),
    ('cap:5-student:2', 0.15, 'Вопрос встал в очередь деканата, и студентка видит его статус.'),
    ('chapter:6-dean-answer', 1.0, 'У деканата вопросы стоят в одной очереди с заявками на справки.'),
    ('cap:6-dean-answer:1', 0.15, 'На частые вопросы есть готовые ответы: вставить, поправить, отправить.'),
    ('chapter:7-student-answer', 0.35, 'Ответ приходит студентке уведомлением. Идти в деканат не нужно.'),
    ('part:7-student-answer', 7.4, 'То, на что раньше уходил день, заняло пару минут.'),
    ('chapter:8-a11y', 0.3, 'Для слабовидящих есть своя версия — она включается одной кнопкой в шапке.'),
    ('cap:8-a11y:1', 0.8, 'Крупный шрифт, контрастные цвета, увеличенные интервалы.'),
    ('cap:8-a11y:2', 0.2, 'И даже на самом узком экране ничего не уезжает вбок.'),
    ('chapter:9-security', 0.25, 'И безопасность. Другой студент вставляет ссылку на чужую справку — и видит «Такой страницы нет».'),
    ('part:9-security', 6.1, 'Чужие данные для него просто не существуют.'),
    ('outro', 2.4, 'Откройте кабинет сами: адрес и {QR-код|кью-ар-код} — на экране, пароль — в комментарии к работе. Проект сделан вместе с нейросетевым агентом {Claude Code|Клод Код}.'),
]
VOICES = {'svetlana': 'ru-RU-SvetlanaNeural', 'dmitry': 'ru-RU-DmitryNeural'}

INTRO, PROBLEM, CHAPTER, OUTRO, XF = 10.5, 10.0, 2.4, 15.0, 0.6

# ---------- раскладка ----------
P_SCALE = 950 / 1560                     # экран телефона 720×1560 → высота 950
P_SW, P_SH = round(720 * P_SCALE), 950
P_BEZEL = 13
P_DW, P_DH = P_SW + 2 * P_BEZEL, P_SH + 2 * P_BEZEL
P_X, P_Y = 1330 - P_DW // 2, (H - P_DH) // 2
TEXT_X, TEXT_W = 190, 800

D_CW, D_CH = 1382, 777                   # окно браузера: содержимое 1920×1080 → 1382×777
D_BAR = 42
D_X, D_Y = (W - D_CW) // 2, 48
D_CY = D_Y + D_BAR


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in_out(p):
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def ease_back(p):
    c = 1.5
    return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2


def prog(t, start, dur):
    if dur <= 0:
        return 1.0 if t >= start else 0.0
    return min(1.0, max(0.0, (t - start) / dur))


def lerp(a, b, k):
    return a + (b - a) * k


# ---------- слои с текстом ----------
def words(text, cls=''):
    # Тире не встаёт в начало строки: оно приклеено к предыдущему слову неразрывным пробелом.
    text = text.replace(' — ', ' — ').replace(' …', ' …')
    out = []
    for w in text.split(' '):
        out.append(f'<span class="w {cls}">{w}</span>')
    return ' '.join(out)


CSS = """
.cap-phone{font:700 54px/1.18 'PT Serif';color:#f2f5fb;letter-spacing:-.003em}
.cap-desk{font:700 40px/1.22 'PT Serif';color:#f2f5fb}
.kicker{font:600 21px/1 Golos;letter-spacing:.2em;text-transform:uppercase;color:#f0b429;white-space:nowrap}
.chap-num{font:700 250px/0.9 'PT Serif';color:#f0b429}
.chap-title{font:700 108px/1.02 'PT Serif';color:#f2f5fb;white-space:nowrap}
.chap-sub{font:400 38px/1.3 Golos;color:#b3bfdc;white-space:nowrap}
.mark{display:flex;align-items:center;gap:14px;font:700 28px/1 Golos;color:#f2f5fb;white-space:nowrap}
.mark small{font:400 italic 20px 'PT Serif';color:#b3bfdc;margin-left:6px}
.url{font:500 17px/1 Golos;color:#c9d3ea;white-space:nowrap;display:flex;gap:8px;align-items:center}
.i-title{font:700 156px/1 'PT Serif';color:#f2f5fb;white-space:nowrap}
.i-sub{font:400 44px/1.25 Golos;color:#d6deef;white-space:nowrap}
.chip{display:inline-block;padding:15px 28px;border-radius:999px;background:rgba(242,245,251,.08);border:1.5px solid rgba(242,245,251,.24);font:500 29px/1 Golos;color:#f2f5fb;white-space:nowrap}
.foot{font:400 25px/1.4 Golos;color:#9eabcb;white-space:nowrap;text-align:center}
.pr-line{font:700 70px/1.1 'PT Serif';color:#f2f5fb;white-space:nowrap}
.pr-line b{color:#9eabcb;font-weight:700}
.pr-final{font:700 60px/1.18 'PT Serif';color:#f2f5fb}
.gold{color:#f0b429}
.o-title{font:700 92px/1 'PT Serif';color:#f2f5fb;white-space:nowrap}
.o-url{font:700 60px/1 Golos;color:#f0b429;white-space:nowrap;letter-spacing:-.01em}
.acc{font:400 31px/1.55 Golos;color:#d6deef;white-space:nowrap}
.acc b{font-weight:700;color:#f2f5fb;font-family:Golos}
.note{font:400 27px/1.4 Golos;color:#9eabcb;white-space:nowrap}
.qr{background:#f2f5fb;border-radius:28px;padding:30px 30px 22px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 0 0 1px rgba(0,0,0,.05)}
.qr img{width:300px;height:300px;display:block}
.qr span{font:600 24px/1 Golos;color:#172a5e}
.credits{font:400 24px/1.5 Golos;color:#9eabcb;white-space:nowrap}
"""

ICON = ('<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" '
        'fill="#f2f5fb"/><g fill="none" stroke="#172a5e" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="11" '
        'stroke-width="2"/><path d="M12.4 13.2 16 17.8l5.2-6.6" stroke-width="2.4"/></g></svg>')
LOCK = ('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9eabcb" stroke-width="2.4"><rect x="5" y="11" width="14" '
        'height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>')

PROBLEM_LINES = [
    ('Расписание', 'в чате группы'),
    ('Баллы', 'в тетради преподавателя'),
    ('Справка', 'очередь в деканат'),
    ('Вопрос', '«зайдите завтра»'),
]
CHIPS = ['Расписание', 'Оценки и рейтинг', 'Справки с QR-кодом', 'Вопрос в деканат', 'Для слабовидящих']


def layer_spec(parts):
    L = []
    add = lambda id, html, width=None: L.append({'id': id, 'html': html, **({'width': width} if width else {})})
    add('mark', f'<div class="mark">{ICON.format(s=44)}<span>Деканат 24/7</span><small>университет «Меридиан»</small></div>')
    for i, p in enumerate(parts):
        num, title, sub, kick = CHAPTERS[p['name']]
        add(f'chnum-{i}', f'<div class="chap-num">{num}</div>')
        add(f'chtitle-{i}', f'<div class="chap-title">{words(title)}</div>')
        add(f'chsub-{i}', f'<div class="chap-sub">{sub}</div>')
        add(f'kick-{i}', f'<div class="kicker">{num} · {kick}</div>')
        if p['kind'] == 'desktop':
            add(f'url-{i}', f'<div class="url">{LOCK}<span>{SITE}{URLS.get(p["name"], "/staff")}</span></div>')
        for j, c in enumerate(p['captions']):
            cls, width = ('cap-phone', TEXT_W) if p['kind'] == 'phone' else ('cap-desk', D_CW)
            add(f'cap-{i}-{j}', f'<div class="{cls}">{words(c["text"])}</div>', width)
    # заставка
    add('i-icon', ICON.format(s=150))
    add('i-title', '<div class="i-title">' + ''.join(f'<span class="w">{ch if ch != " " else "&nbsp;"}</span>' for ch in 'Деканат 24/7') + '</div>')
    add('i-sub', '<div class="i-sub">Личный кабинет студента университета «Меридиан»</div>')
    for k, c in enumerate(CHIPS):
        add(f'chip-{k}', f'<div class="chip">{c}</div>')
    add('i-foot', '<div class="foot">MGIMO AI Challenge 2026 · номинация «Вайб-кодинг»<br>Концепт: университет и все данные вымышлены</div>')
    # как было
    add('pr-kick', '<div class="kicker">Как обычно</div>')
    for k, (a, b) in enumerate(PROBLEM_LINES):
        add(f'pr-{k}', f'<div class="pr-line">{words(a)} <b class="w">—</b> {words(b, "")}</div>')
    add('pr-final', '<div class="pr-final">' + words('Деканат 24/7', 'gold') + ' ' + words('— всё это в одном кабинете, круглосуточно и с телефона') + '</div>', 1300)
    # финал
    add('o-kick', '<div class="kicker">Попробуйте сами</div>')
    add('o-title', f'<div class="o-title">{words("Откройте кабинет")}</div>')
    add('o-url', f'<div class="o-url">{SITE}</div>')
    add('o-acc', '<div class="acc"><b>student1</b>, <b>student2</b> — студенты<br><b>teacher</b> — преподаватель<br><b>dean</b> — сотрудник деканата</div>')
    add('o-note', '<div class="note">Пароль — в комментарии к конкурсной работе.<br>Внутри — «Путеводитель» по всем сценариям.</div>')
    L.append({'id': 'o-qr', 'html': '<div class="qr"><img src="{{qr}}"><span>Открыть с телефона</span></div>', 'qr': f'https://{SITE}'})
    add('o-credits', f'<div class="credits">Сделано с ИИ-агентом Claude Code · {stages_label()} в журнале процесса · 312 юнит- и 70 e2e-тестов<br>'
        'Код и описание процесса: github.com/MrYar07/dekanat-24-7</div>')
    return {'css': CSS, 'layers': L}


# ---------- таймлайн ----------
def timeline(parts):
    """Сцены подряд с наплывом XF. Возвращает список (вид, индекс части, начало, длительность)."""
    scenes, t = [], 0.0

    def push(kind, idx, dur):
        nonlocal t
        scenes.append((kind, idx, t, dur))
        t += dur - XF

    push('intro', None, INTRO)
    push('problem', None, PROBLEM)
    for i, p in enumerate(parts):
        push('chapter', i, CHAPTER)
        push('part', i, p['end'] - p['start'] + 0.4)
    push('outro', None, OUTRO)
    total = t + XF
    return scenes, total


# ---------- рендер (живёт в каждом процессе) ----------
G = {}


def init(rec):
    global REC, BUILD, LAYERS
    REC, BUILD, LAYERS = rec, rec + '/build', rec + '/build/layers'
    parts = json.load(open(REC + '/parts.json', encoding='utf8'))
    G['parts'] = parts
    G['scenes'], G['total'] = timeline(parts)
    G['meta'] = json.load(open(LAYERS + '/layers.json', encoding='utf8'))
    G['img'] = {}
    G['words'] = {}
    G['frames'] = {}
    G['ats'] = [[f['at'] for f in p['frames']] for p in parts]
    # Сколько пикселей кадра в одном CSS-пикселе: координаты нажатий записаны в CSS-пикселях.
    G['px'] = [Image.open(p['frames'][0]['file']).width / (360 if p['kind'] == 'phone' else 1280) for p in parts]
    G['bg'] = Image.open(BUILD + '/bg.png').convert('RGBA')
    G['phone'] = Image.open(BUILD + '/phone.png')
    G['phone_mask'] = Image.open(BUILD + '/phone-mask.png')
    G['window'] = Image.open(BUILD + '/window.png')
    G['content_mask'] = Image.open(BUILD + '/content-mask.png')
    G['cursor'] = Image.open(BUILD + '/cursor.png')
    G['touch'] = Image.open(BUILD + '/touch.png')


def layer(id):
    if id not in G['img']:
        G['img'][id] = Image.open(f'{LAYERS}/{id}.png').convert('RGBA')
    return G['img'][id]


def fade(img, a):
    if a >= 0.999:
        return img
    arr = np.array(img)
    arr[..., 3] = (arr[..., 3].astype(np.float32) * a).astype(np.uint8)
    return Image.fromarray(arr)


def blit(base, img, x, y, a=1.0):
    if a <= 0.004:
        return
    x, y = int(round(x)), int(round(y))
    sx, sy = max(0, -x), max(0, -y)
    dx, dy = max(0, x), max(0, y)
    w = min(img.width - sx, base.width - dx)
    h = min(img.height - sy, base.height - dy)
    if w <= 0 or h <= 0:
        return
    if sx or sy or w != img.width or h != img.height:
        img = img.crop((sx, sy, sx + w, sy + h))
    base.alpha_composite(fade(img, a), (dx, dy))


def word_pieces(id):
    """Слова слоя отдельными картинками: (картинка, x, y). Если слов нет — весь слой одним куском."""
    if id in G['words']:
        return G['words'][id]
    img, m = layer(id), G['meta'][id]
    pieces = []
    if not m['words']:
        pieces = [(img, 0, 0)]
    else:
        for b in m['words']:
            x0, y0 = max(0, int(b['x']) - 3), max(0, int(b['y']) - 8)
            x1, y1 = min(img.width, int(math.ceil(b['x'] + b['w'])) + 3), min(img.height, int(math.ceil(b['y'] + b['h'])) + 8)
            pieces.append((img.crop((x0, y0, x1, y1)), x0, y0))
    G['words'][id] = pieces
    return pieces


def text_in(base, id, x, y, t, t_in, a=1.0, t_out=None, stagger=0.045, dur=0.55, rise=20):
    """Слова поднимаются и проявляются по очереди; на выходе слой гаснет и чуть уходит вверх."""
    if t < t_in:
        return
    out_k = prog(t, t_out, 0.32) if t_out is not None else 0.0
    if out_k >= 1:
        return
    for k, (img, wx, wy) in enumerate(word_pieces(id)):
        p = ease_out(prog(t, t_in + k * stagger, dur))
        if p <= 0:
            continue
        blit(base, img, x + wx, y + wy + (1 - p) * rise - out_k * 12, a * p * (1 - out_k))


def fade_in(base, id, x, y, t, t_in, a=1.0, dur=0.6, rise=16, t_out=None):
    p = ease_out(prog(t, t_in, dur))
    out_k = prog(t, t_out, 0.32) if t_out is not None else 0.0
    if p > 0 and out_k < 1:
        blit(base, layer(id), x, y + (1 - p) * rise - out_k * 10, a * p * (1 - out_k))


def background(t):
    bg = G['bg']
    ox = (bg.width - W) / 2 + 150 * math.sin(2 * math.pi * t / 47)
    oy = (bg.height - H) / 2 + 90 * math.sin(2 * math.pi * t / 61 + 1)
    return bg.crop((int(ox), int(oy), int(ox) + W, int(oy) + H))


def progress(base, x, y, i, a):
    n = len(G['parts'])
    d = ImageDraw.Draw(base)
    for k in range(n):
        col = GOLD + (int(255 * a),) if k == i else INK + (int((110 if k < i else 40) * a),)
        d.rounded_rectangle([x + k * 50, y, x + k * 50 + 40, y + 5], radius=3, fill=col)


# ----- сцены -----
def scene_intro(base, t, a):
    m = G['meta']
    icon = layer('i-icon')
    p = ease_back(prog(t, 0.35, 0.8))
    if p > 0:
        s = 0.7 + 0.3 * p
        img = icon.resize((max(1, int(icon.width * s)), max(1, int(icon.height * s))), Image.LANCZOS)
        blit(base, img, W / 2 - img.width / 2, 250 - img.height / 2, a * min(1, prog(t, 0.35, 0.4)))
    tw = m['i-title']['w']
    text_in(base, 'i-title', W / 2 - tw / 2, 360, t, 0.9, a, stagger=0.05, dur=0.7, rise=40)
    sw = m['i-sub']['w']
    fade_in(base, 'i-sub', W / 2 - sw / 2, 545, t, 2.0, a, dur=0.8)
    # плашки по центру в ряд
    ws = [m[f'chip-{k}']['w'] for k in range(len(CHIPS))]
    gap = -6
    x = W / 2 - (sum(ws) + gap * (len(ws) - 1)) / 2
    for k, w in enumerate(ws):
        p = ease_back(prog(t, 3.0 + k * 0.14, 0.6))
        if p > 0:
            blit(base, layer(f'chip-{k}'), x, 660 + (1 - p) * 26, a * min(1, prog(t, 3.0 + k * 0.14, 0.35)))
        x += w + gap
    fw = m['i-foot']['w']
    fade_in(base, 'i-foot', W / 2 - fw / 2, 880, t, 4.6, a, dur=1.0, rise=0)


def scene_problem(base, t, a):
    fade_in(base, 'pr-kick', 248, 196, t, 0.2, a)
    d = None
    for k in range(len(PROBLEM_LINES)):
        y = 250 + k * 104
        dim = 1 - 0.6 * ease_in_out(prog(t, 4.6 + k * 0.12, 0.6))
        text_in(base, f'pr-{k}', 248, y, t, 0.5 + k * 0.75, a * dim, stagger=0.06, dur=0.6, rise=26)
        # зачёркивание
        sp = ease_in_out(prog(t, 4.3 + k * 0.15, 0.55))
        if sp > 0:
            if d is None:
                d = ImageDraw.Draw(base)
            w = G['meta'][f'pr-{k}']['w'] - 24
            yy = y + 12 + 46
            d.line([(260, yy), (260 + w * sp, yy)], fill=(255, 107, 94, int(230 * a)), width=6)
    text_in(base, 'pr-final', 248, 712, t, 5.7, a, stagger=0.06, dur=0.65, rise=26)


def scene_chapter(base, t, a, i):
    m = G['meta']
    p = ease_out(prog(t, 0.0, 0.7))
    blit(base, layer(f'chnum-{i}'), 200 - (1 - p) * 60, 330, a * p * 0.95)
    x = 200 + m[f'chnum-{i}']['w'] + 30
    text_in(base, f'chtitle-{i}', x, 372, t, 0.15, a, stagger=0.08, dur=0.6, rise=30)
    lp = ease_in_out(prog(t, 0.45, 0.6))
    if lp > 0:
        ImageDraw.Draw(base).rounded_rectangle([x + 12, 520, x + 12 + 180 * lp, 526], radius=3, fill=GOLD + (int(255 * a),))
    fade_in(base, f'chsub-{i}', x, 548, t, 0.55, a, dur=0.6)


def frame_at(i, rec_t):
    ats = G['ats'][i]
    k = max(0, bisect.bisect_right(ats, rec_t) - 1)
    return G['parts'][i]['frames'][k]['file']


def cached(key, make):
    c = G['frames']
    if key not in c:
        if len(c) > 48:
            c.pop(next(iter(c)))
        c[key] = make()
    return c[key]


def phone_screen(file):
    def make():
        img = Image.open(file).convert('RGB').resize((P_SW, P_SH), Image.LANCZOS).convert('RGBA')
        img.putalpha(G['phone_mask'])
        dev = G['phone'].copy()
        dev.alpha_composite(img, (G['phone_pad'] + P_BEZEL, G['phone_pad'] + P_BEZEL))
        return dev
    G.setdefault('phone_pad', (G['phone'].width - P_DW) // 2)
    return cached(('p', file), make)


def touch(base, x, y, tau, taps_t, a):
    """Касание пальцем: мягкий круг за мгновение до нажатия и расходящееся кольцо."""
    for tt in taps_t:
        if tt - 0.4 <= tau <= tt + 0.8:
            pin = ease_out(prog(tau, tt - 0.4, 0.25))
            pout = prog(tau, tt + 0.35, 0.3)
            s = 1.25 - 0.25 * pin
            al = pin * (1 - pout)
            if al > 0:
                img = G['touch']
                sz = int(img.width * s)
                im = img.resize((sz, sz), Image.LANCZOS)
                blit(base, im, x - sz / 2, y - sz / 2, a * al * 0.9)
            rp = prog(tau, tt, 0.55)
            if 0 < rp < 1:
                r = 22 + 40 * ease_out(rp)
                ImageDraw.Draw(base).ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255, int(200 * a * (1 - rp))), width=3)


def scene_part(base, t, a, i):
    p = G['parts'][i]
    tau = t
    rec_t = min(p['end'], p['start'] + tau)
    e = ease_out(prog(tau, 0.0, 0.85))
    caps = [(max(c['at'] - p['start'], 0.35), j) for j, c in enumerate(p['captions'])]
    taps = [(tp['at'] - p['start'], tp) for tp in p['taps']]

    if p['kind'] == 'phone':
        blit(base, layer('mark'), TEXT_X - 12, 96, a)
        fade_in(base, f'kick-{i}', TEXT_X - 12, 300, t, 0.15, a)
        for k, (ct, j) in enumerate(caps):
            nxt = caps[k + 1][0] if k + 1 < len(caps) else None
            text_in(base, f'cap-{i}-{j}', TEXT_X - 12, 342, tau, ct + (0.18 if k else 0), a, t_out=nxt)
        progress(base, TEXT_X, 980, i, a)
        dev = phone_screen(frame_at(i, rec_t))
        pad = G['phone_pad']
        dx, dy = P_X - pad, P_Y - pad + (1 - e) * 80
        blit(base, dev, dx, dy, a * e)
        sx, sy = P_X + P_BEZEL, P_Y + P_BEZEL + (1 - e) * 80
        k = P_SW / 360
        for tt, tp in taps:
            if tt - 0.45 <= tau <= tt + 0.85:
                touch(base, sx + (tp['x'] + tp['w'] / 2) * k, sy + (tp['y'] + tp['h'] / 2) * k, tau, [tt], a * e)
        return

    # компьютер: окно браузера, наезды, курсор
    sc = G['px'][i]
    zoom, x0, y0 = 1.0, 0.0, 0.0
    for f in p['focus']:
        f0, f1 = f['from'] - p['start'], f['to'] - p['start']
        amt = ease_in_out(prog(tau, f0 - 0.2, 0.9)) * (1 - ease_in_out(prog(tau, f1 + 0.3, 0.9)))
        if amt > 0:
            zoom = 1 + (f['zoom'] - 1) * amt
            # Цель целиком в кадре с полями; если шире кадра — видна её левая часть (там подпись строки).
            fw, fh = W / f['zoom'], H / f['zoom']
            bx0, bx1 = f['x'] * sc - 40, (f['x'] + f['w']) * sc + 40
            by0, by1 = f['y'] * sc - 40, (f['y'] + f['h']) * sc + 40
            tx = bx0 + fw / 2 if bx1 - bx0 > fw else min(max((bx0 + bx1) / 2, bx1 - fw / 2), bx0 + fw / 2)
            ty = by0 + fh / 2 if by1 - by0 > fh else (by0 + by1) / 2
            # Двигаем угол кадра, а не центр: левый край цели виден на всём наезде.
            x0 = amt * min(max(tx - fw / 2, 0), W - fw)
            y0 = amt * min(max(ty - fh / 2, 0), H - fh)
    cw, ch = W / zoom, H / zoom
    x0 = min(max(x0, 0), W - cw)
    y0 = min(max(y0, 0), H - ch)
    file = frame_at(i, rec_t)
    if zoom == 1.0:
        content = cached(('d', file), lambda: _content(file, (0, 0, W, H)))
    else:
        content = _content(file, (x0, y0, x0 + cw, y0 + ch))
    lift = (1 - e) * 60
    win = G['window']
    wp = G.setdefault('win_pad', (win.width - D_CW) // 2)
    blit(base, win, D_X - wp, D_Y - wp + lift, a * e)
    blit(base, layer(f'url-{i}'), D_X + 200, D_Y + 7 + lift, a * e * 0.95)
    blit(base, content, D_X, D_CY + lift, a * e)
    k = D_CW / cw

    def to_dest(px, py):
        return D_X + (px - x0) * k, D_CY + lift + (py - y0) * k

    # курсор: подъезжает к цели за ~0,7 с до нажатия по лёгкой дуге
    pts = [((tp['x'] + tp['w'] / 2) * sc, (tp['y'] + tp['h'] / 2) * sc, tt) for tt, tp in taps]
    if pts:
        pos, prev = (W * 0.78, H * 0.92), (W * 0.78, H * 0.92)
        click = None
        for n, (px, py, tt) in enumerate(pts):
            t0 = max(tt - 0.75, (pts[n - 1][2] + 0.25) if n else 0.3)
            if tau < t0:
                pos = prev
                break
            if tau < tt:
                q = ease_in_out(prog(tau, t0, max(0.05, tt - 0.05 - t0)))
                mx, my = lerp(prev[0], px, q), lerp(prev[1], py, q)
                dxv, dyv = px - prev[0], py - prev[1]
                ln = math.hypot(dxv, dyv) or 1
                arc = math.sin(math.pi * q) * min(60, ln * 0.12)
                pos = (mx - dyv / ln * arc, my + dxv / ln * arc)
                break
            pos, prev = (px, py), (px, py)
            if tau - tt < 0.6:
                click = tau - tt
        else:
            pos = prev
        cxd, cyd = to_dest(*pos)
        ca = a * ease_out(prog(tau, 0.5, 0.4))
        if click is not None:
            rp = click / 0.5
            if rp < 1:
                r = 10 + 30 * ease_out(rp)
                ImageDraw.Draw(base).ellipse([cxd - r, cyd - r, cxd + r, cyd + r], outline=GOLD + (int(220 * ca * (1 - rp)),), width=3)
        cur = G['cursor']
        s = 1 - 0.12 * (math.sin(math.pi * min(1, click / 0.18)) if click is not None and click < 0.18 else 0)
        img = cur if s == 1 else cur.resize((int(cur.width * s), int(cur.height * s)), Image.LANCZOS)
        blit(base, img, cxd - 6 * s, cyd - 4 * s, ca)

    fade_in(base, f'kick-{i}', D_X - 12, 890, t, 0.15, a)
    progress(base, D_X + D_CW - 440, 897, i, a)
    for kk, (ct, j) in enumerate(caps):
        nxt = caps[kk + 1][0] if kk + 1 < len(caps) else None
        text_in(base, f'cap-{i}-{j}', D_X - 12, 920, tau, ct + (0.18 if kk else 0), a, t_out=nxt, rise=14)


def _content(file, box):
    img = Image.open(file).convert('RGB')
    box = (max(0.0, box[0]), max(0.0, box[1]), min(float(img.width), box[2]), min(float(img.height), box[3]))
    img = img.resize((D_CW, D_CH), Image.LANCZOS if box == (0, 0, img.width, img.height) else Image.BICUBIC, box=box).convert('RGBA')
    img.putalpha(G['content_mask'])
    return img


def scene_outro(base, t, a):
    m = G['meta']
    fade_in(base, 'o-kick', 188, 190, t, 0.2, a)
    text_in(base, 'o-title', 188, 232, t, 0.35, a, stagger=0.08, dur=0.7, rise=30)
    fade_in(base, 'o-url', 188, 372, t, 0.9, a, dur=0.7)
    fade_in(base, 'o-acc', 188, 486, t, 1.4, a, dur=0.7)
    fade_in(base, 'o-note', 188, 680, t, 1.9, a, dur=0.7)
    qp = ease_back(prog(t, 1.1, 0.8))
    if qp > 0:
        qr = layer('o-qr')
        s = 0.9 + 0.1 * qp
        img = qr.resize((int(qr.width * s), int(qr.height * s)), Image.LANCZOS)
        blit(base, img, 1450 - img.width / 2, 470 - img.height / 2, a * min(1, prog(t, 1.1, 0.4)))
    cw = m['o-credits']['w']
    fade_in(base, 'o-credits', 188, 900, t, 3.0, a, dur=0.9, rise=0)


def render(fi):
    t = fi / FPS
    base = background(t)
    for kind, idx, start, dur in G['scenes']:
        if not (start <= t < start + dur):
            continue
        tau = t - start
        first, last = start == 0, kind == 'outro'
        a = 1.0
        if not first:
            a *= ease_in_out(prog(tau, 0, XF))
        if not last:
            a *= 1 - ease_in_out(prog(tau, dur - XF, XF))
        if kind == 'intro':
            scene_intro(base, tau, a)
        elif kind == 'problem':
            scene_problem(base, tau, a)
        elif kind == 'chapter':
            scene_chapter(base, tau, a, idx)
        elif kind == 'part':
            scene_part(base, tau, a, idx)
        else:
            scene_outro(base, tau, a)
    rgb = base.convert('RGB')
    # из темноты в начале и в темноту в конце
    k = min(prog(t, 0, 0.8), 1 - prog(t, G['total'] - 1.4, 1.4))
    if k < 1:
        rgb = Image.blend(Image.new('RGB', (W, H)), rgb, max(0.0, k))
    return rgb


def render_chunk(args):
    rec, a, b, out = args
    init(rec)
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-g', '60', '-bf', '2', out],
                          stdin=subprocess.PIPE)
    for fi in range(a, b):
        ff.stdin.write(render(fi).tobytes())
    ff.stdin.close()
    ff.wait()
    return out


# ---------- статичные картинки ----------
def rounded_mask(w, h, r, top=True, bottom=True, ss=4):
    m = Image.new('L', (w * ss, h * ss), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], radius=r * ss, fill=255,
                        corners=(top, top, bottom, bottom))
    return m.resize((w, h), Image.LANCZOS)


def shadow(w, h, r, pad, blur, alpha):
    img = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([pad, pad + blur // 3, pad + w, pad + h + blur // 3], radius=r, fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    img.putalpha(m)
    return img


def make_static():
    os.makedirs(BUILD, exist_ok=True)
    # фон: градиент и размытые пятна — считаем в четверть размера и растягиваем, полос нет благодаря зерну
    bw, bh = 2300, 1400
    s = 4
    sm = Image.new('RGB', (bw // s, bh // s))
    top, bot = np.array([10, 20, 52], np.float32), np.array([20, 36, 86], np.float32)
    yy = np.linspace(0, 1, bh // s)[:, None, None]
    arr = top * (1 - yy) + bot * yy
    arr = np.repeat(arr, bw // s, axis=1)
    sm = Image.fromarray(arr.astype(np.uint8))
    blobs = Image.new('RGBA', sm.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(blobs)
    for (x, y, r, col) in [(560, 330, 540, (46, 84, 196, 150)), (1850, 1040, 620, (110, 74, 200, 115)),
                           (1580, 230, 400, (40, 130, 150, 70)), (300, 1200, 420, (30, 60, 150, 90))]:
        d.ellipse([(x - r) / s, (y - r) / s, (x + r) / s, (y + r) / s], fill=col)
    blobs = blobs.filter(ImageFilter.GaussianBlur(220 / s))
    sm = sm.convert('RGBA')
    sm.alpha_composite(blobs)
    big = sm.convert('RGB').resize((bw, bh), Image.BICUBIC)
    a = np.array(big).astype(np.float32)
    # виньетка и зерно
    yv, xv = np.mgrid[0:bh, 0:bw]
    v = ((xv - bw / 2) / (bw / 2)) ** 2 + ((yv - bh / 2) / (bh / 2)) ** 2
    a *= (1 - 0.28 * np.clip(v, 0, 1.6) / 1.6)[..., None]
    a += np.random.default_rng(7).normal(0, 1.6, a.shape)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(BUILD + '/bg.png')

    # телефон: корпус, тень, маска экрана
    pad = 70
    ph = shadow(P_DW, P_DH, 64, pad, 40, 170)
    body = Image.new('RGBA', (P_DW * 4, P_DH * 4), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rounded_rectangle([0, 0, P_DW * 4 - 1, P_DH * 4 - 1], radius=64 * 4, fill=(14, 19, 38, 255))
    bd.rounded_rectangle([3 * 4, 3 * 4, P_DW * 4 - 1 - 12, P_DH * 4 - 1 - 12], radius=61 * 4, outline=(58, 70, 112, 255), width=6)
    body = body.resize((P_DW, P_DH), Image.LANCZOS)
    ph.alpha_composite(body, (pad, pad))
    ph.save(BUILD + '/phone.png')
    rounded_mask(P_SW, P_SH, 50).save(BUILD + '/phone-mask.png')

    # окно браузера: тень, панель с кнопками и адресом
    pad = 80
    win = shadow(D_CW, D_CH + D_BAR, 16, pad, 46, 175)
    bar = Image.new('RGBA', (D_CW * 4, (D_CH + D_BAR) * 4), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rounded_rectangle([0, 0, D_CW * 4 - 1, (D_CH + D_BAR) * 4 - 1], radius=16 * 4, fill=(27, 38, 78, 255))
    for k, col in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        cx = (24 + k * 22) * 4
        bd.ellipse([cx - 6 * 4, 21 * 4 - 6 * 4, cx + 6 * 4, 21 * 4 + 6 * 4], fill=col + (255,))
    bd.rounded_rectangle([185 * 4, 7 * 4, (D_CW - 185) * 4, 35 * 4], radius=14 * 4, fill=(14, 22, 50, 255))
    bar = bar.resize((D_CW, D_CH + D_BAR), Image.LANCZOS)
    win.alpha_composite(bar, (pad, pad))
    win.save(BUILD + '/window.png')
    rounded_mask(D_CW, D_CH, 16, top=False).save(BUILD + '/content-mask.png')

    # курсор-стрелка: белый с тёмной обводкой и мягкой тенью
    ss = 6
    pts = [(0, 0), (0, 31), (8, 24), (13.5, 36), (19, 33.5), (13.5, 22), (23, 22)]
    cur = Image.new('RGBA', (44 * ss, 52 * ss), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cur)
    P = [((x + 6) * ss, (y + 4) * ss) for x, y in pts]
    cd.polygon(P, fill=(20, 24, 40, 255))
    inner = [((x * 0.86 + 6 + 1.6) * ss, (y * 0.86 + 4 + 2.9) * ss) for x, y in pts]
    cd.polygon(inner, fill=(255, 255, 255, 255))
    cur = cur.resize((44, 52), Image.LANCZOS)
    sh = Image.new('RGBA', cur.size, (0, 0, 0, 0))
    sh.putalpha(cur.getchannel('A').filter(ImageFilter.GaussianBlur(3)).point(lambda v: v * 0.45))
    out = Image.new('RGBA', (50, 58), (0, 0, 0, 0))
    out.alpha_composite(sh, (3, 4))
    out.alpha_composite(cur, (0, 0))
    out.save(BUILD + '/cursor.png')

    # касание: полупрозрачный круг с мягким краем
    r = 34
    tc = Image.new('RGBA', (r * 2 * 4, r * 2 * 4), (0, 0, 0, 0))
    ImageDraw.Draw(tc).ellipse([4, 4, r * 8 - 5, r * 8 - 5], fill=(255, 255, 255, 150), outline=(255, 255, 255, 230), width=10)
    tc = tc.resize((r * 2, r * 2), Image.LANCZOS)
    tc.save(BUILD + '/touch.png')


# ---------- звук ----------
SR = 44100


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lowpass(x, fc, order=4):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** (2 * order))
    return np.fft.irfft(X, len(x))


def highpass(x, fc, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X, len(x))


def fft_convolve(x, h):
    n = len(x) + len(h) - 1
    N = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(h, N), N)[:len(x)]


def music(total, events, beat_from, beat_to):
    """Лёгкая фоновая музыка: светлые аккорды, переливы «калимбы», колокольчик на смене аккорда,
    мягкий бас и тихий ритм (только между заставкой и финалом). Плюс звуки касаний и переходов."""
    n = int(total * SR) + SR
    t = np.arange(n) / SR
    L, R = np.zeros(n), np.zeros(n)
    bpm = 100
    beat = 60 / bpm
    bar = beat * 4
    chord_len = bar * 2
    # Ре мажор: Dmaj7 — Bm7 — Gmaj7 — A, голоса в средне-высоком регистре, чтобы было светло и не мешало голосу.
    chords = [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]]
    rng = np.random.default_rng(5)

    def put(dst_l, dst_r, a0, w, pan=0.5):
        if a0 >= n:
            return
        a1 = min(n, a0 + len(w))
        w = w[:a1 - a0]
        dst_l[a0:a1] += w * (1 - pan)
        dst_r[a0:a1] += w * pan

    def chord_at(sec):
        return chords[int(sec // chord_len) % 4]

    def tail(x, ms=25):
        """Плавный конец за ms миллисекунд: звук не обрывается щелчком."""
        return np.clip((x[-1] - x) / (ms / 1000), 0, 1)

    # пэд: медленная атака, мягкий спад, лёгкая расстройка по сторонам
    c0, k = 0.0, 0
    while c0 < total:
        ch = chords[k % 4]
        a0, a1 = int(max(0, c0 - 0.8) * SR), min(n, int((c0 + chord_len + 1.8) * SR))
        tt = t[a0:a1] - c0
        env = (np.clip((tt + 0.8) / 1.6, 0, 1) * np.clip((chord_len + 1.8 - tt) / 2.2, 0, 1)) ** 1.6
        for j, m in enumerate(ch):
            f = midi(m)
            for det, pan in [(-0.003, 0.2), (0.003, 0.8)]:
                w = (np.sin(2 * np.pi * f * (1 + det) * tt + j) + 0.22 * np.sin(4 * np.pi * f * (1 + det) * tt + 2 * j)) * env * 0.010
                L[a0:a1] += w * (1 - pan)
                R[a0:a1] += w * pan
        c0 += chord_len
        k += 1
    L, R = lowpass(L, 3200), lowpass(R, 3200)

    # «калимба»: восьмые по нотам аккорда, с лёгким разбросом громкости
    pat = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1]
    step = beat / 2
    ln = int(1.4 * SR)
    x = np.arange(ln) / SR
    att = np.clip(x / 0.003, 0, 1) * tail(x, 60)
    s, i = 0.0, 0
    while s < total - 2:
        ch = chord_at(s)
        notes = [m + 12 for m in ch] + [ch[0] + 24]   # на октаву выше голоса — светлее и не спорит с речью
        f = midi(notes[pat[i % 16]])
        w = (np.sin(2 * np.pi * f * x) * np.exp(-x / 0.38)
             + 0.30 * np.sin(4 * np.pi * f * x) * np.exp(-x / 0.12)
             + 0.10 * np.sin(2 * np.pi * 5.4 * f * x) * np.exp(-x / 0.025)) * att
        vel = (1.0 if i % 4 == 0 else 0.72 if i % 2 == 0 else 0.55) * (0.85 + 0.3 * rng.random())
        put(L, R, int(s * SR), w * vel * 0.050, 0.35 if i % 2 else 0.65)
        s += step
        i += 1

    # колокольчик на каждой смене аккорда
    ln = int(2.5 * SR)
    x = np.arange(ln) / SR
    c0 = 0.0
    while c0 < total - 3:
        f = midi(chord_at(c0)[3] + 12)
        w = (np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * 2.76 * f * x) * np.exp(-x / 0.3)) * np.exp(-x / 1.1) * np.clip(x / 0.004, 0, 1) * tail(x, 300)
        put(L, R, int(c0 * SR), w * 0.028, 0.72)
        c0 += chord_len

    # реверберация на мелодическую часть
    ir_t = np.arange(int(2.2 * SR)) / SR
    for side in (0, 1):
        ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t / 0.6)
        ir = lowpass(ir, 6000)
        ir /= np.sqrt(np.sum(ir ** 2))
        if side == 0:
            L = L + 0.32 * fft_convolve(L, ir)
        else:
            R = R + 0.32 * fft_convolve(R, ir)

    # ритм и бас — между заставкой и финалом, вход и выход за такт
    groove = np.clip((t - beat_from) / bar, 0, 1) * np.clip((beat_to - t) / bar, 0, 1)
    BL, BR = np.zeros(n), np.zeros(n)
    kx = np.arange(int(0.35 * SR)) / SR
    kick = np.sin(2 * np.pi * (62 * kx + 90 * 0.03 * (1 - np.exp(-kx / 0.03)))) * np.exp(-kx / 0.16) * np.clip(kx / 0.002, 0, 1) * tail(kx, 40)
    sx = np.arange(int(0.12 * SR)) / SR
    bx = np.arange(int(1.6 * SR)) / SR
    s = max(0.0, math.floor(beat_from / bar) * bar)
    while s < min(total, beat_to + bar):
        ch = chord_at(s)
        for bt in range(4):
            at = s + bt * beat
            a0 = int(at * SR)
            if bt in (0, 2):
                put(BL, BR, a0, kick * 0.05)
            if bt in (1, 3):  # мягкий «рим»: короткий шум в середине диапазона и тихий тон
                nz = rng.normal(0, 1, len(sx))
                nz = lowpass(nz, 3500) - lowpass(nz, 900)
                put(BL, BR, a0, (nz * 0.9 + np.sin(2 * np.pi * 210 * sx)) * np.exp(-sx / 0.05) * np.clip(sx / 0.001, 0, 1) * tail(sx) * 0.030, 0.45)
            # шейкер на слабые доли восьмых
            nz = rng.normal(0, 1, len(sx))
            nz = nz - lowpass(nz, 6000)
            put(BL, BR, int((at + beat / 2) * SR), nz * np.clip(sx / 0.003, 0, 1) * np.exp(-sx / 0.022) * 0.045, 0.62)
        # бас: корень аккорда, синкопа «раз … и-три»
        fb = midi(ch[0] - 24)
        for off, dur, v in [(0, 1.6, 1.0), (2.5 * beat, 0.9, 0.7), (3.5 * beat, 0.4, 0.5)]:
            m = min(len(bx), int(dur * SR))
            w = (np.sin(2 * np.pi * fb * bx[:m]) + 0.3 * np.sin(4 * np.pi * fb * bx[:m])) * np.exp(-bx[:m] / 0.45) * np.clip(bx[:m] / 0.006, 0, 1)
            w *= np.clip((dur - bx[:m]) / 0.05, 0, 1)
            put(BL, BR, int((s + off) * SR), w * v * 0.055)
        s += bar
    L += BL * groove
    R += BR * groove

    # звуки: переход — «вдох» шума, касание — тихий щелчок
    for kind, at in events:
        a0 = int(at * SR)
        if kind == 'whoosh':
            ln = int(0.9 * SR)
            a0 = max(0, a0 - ln // 2)
            a1 = min(n, a0 + ln)
            x = np.arange(a1 - a0) / SR
            nz = lowpass(rng.normal(0, 1, a1 - a0), 2600)
            env = np.sin(np.pi * x / (ln / SR)) ** 2
            w = nz * env * 0.018
            pan = x / (ln / SR)
            L[a0:a1] += w * (1 - pan)
            R[a0:a1] += w * pan
        else:
            ln = int(0.08 * SR)
            a1 = min(n, a0 + ln)
            x = np.arange(a1 - a0) / SR
            w = (np.sin(2 * np.pi * 2300 * x) * np.exp(-x / 0.008) + 0.6 * np.sin(2 * np.pi * 1150 * x) * np.exp(-x / 0.02)) * 0.04
            L[a0:a1] += w
            R[a0:a1] += w

    st = np.stack([highpass(L, 35), highpass(R, 35)], 1)[: int(total * SR)]   # без инфранизов: их не слышно, а запас громкости они съедают
    fade_n = int(3.0 * SR)
    st[:int(1.2 * SR)] *= np.linspace(0, 1, int(1.2 * SR))[:, None]
    st[-fade_n:] *= np.linspace(1, 0, fade_n)[:, None] ** 1.5
    st *= 0.5 / max(1e-6, np.max(np.abs(st)))
    return st


# ---------- голос ----------
EDGE_TTS = os.environ.get('EDGE_TTS', 'edge-tts')
VOICE_RATES = [0, 4, 8, 12]   # если фраза не успевает до следующей — чуть быстрее, но не больше +12 %


def spoken(text):
    """{как показать|как произнести} → как произнести."""
    return re.sub(r'\{([^|{}]*)\|([^{}]*)\}', r'\2', text)


def shown(text):
    return re.sub(r'\{([^|{}]*)\|([^{}]*)\}', r'\1', text)


def decode(path):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).astype(np.float64)


def tts(text, voice, rate):
    """Фраза голосом Microsoft (edge-tts). Готовые фразы кэшируются в build/voice — повторная сборка не ходит в сеть."""
    key = hashlib.sha1(f'{voice}|{rate}|{text}'.encode('utf8')).hexdigest()[:16]
    path = f'{BUILD}/voice/{key}.mp3'
    if not os.path.exists(path):
        os.makedirs(BUILD + '/voice', exist_ok=True)
        tmp = path + '.part.mp3'
        for _ in range(4):
            r = subprocess.run([EDGE_TTS, '--voice', voice, f'--rate={rate:+d}%', '--text', text, '--write-media', tmp], capture_output=True)
            if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 2000:
                break
        else:
            sys.exit(f'edge-tts не ответил: {r.stderr.decode("utf8", "replace")[-300:]}')
        os.replace(tmp, path)
    x = decode(path)
    loud = np.nonzero(np.abs(x) > 0.01)[0]
    x = x[max(0, loud[0] - int(0.03 * SR)): min(len(x), loud[-1] + int(0.10 * SR))]
    voiced = x[np.abs(x) > 0.02]
    return x * (0.1 / max(1e-6, np.sqrt(np.mean(voiced ** 2))))   # все фразы — к одной громкости


def anchor_times(parts, scenes):
    A = {}
    for kind, idx, start, dur in scenes:
        if idx is None:
            A[kind] = start
            continue
        p = parts[idx]
        A[f'{kind}:{p["name"]}'] = start
        if kind == 'part':
            for j, c in enumerate(p['captions']):
                A[f'cap:{p["name"]}:{j}'] = start + max(c['at'] - p['start'], 0.35)
    return A


def narration(parts, scenes, total, voice):
    """Дорожка голоса и список фраз (начало, конец, текст для субтитров). Печатает, как фразы легли во времени."""
    A = anchor_times(parts, scenes)
    starts = [A[a] + d for a, d, _ in NARRATION]
    track = np.zeros(int(total * SR) + SR)
    segs, over = [], 0
    for k, (a, d, text) in enumerate(NARRATION):
        s = starts[k]
        limit = (starts[k + 1] if k + 1 < len(starts) else total - 2.0) - 0.25
        for rate in VOICE_RATES:
            x = tts(spoken(text), voice, rate)
            if s + len(x) / SR <= limit:
                break
        e = s + len(x) / SR
        flag = ''
        if e > limit:
            flag = f'   <- не влезает на {e - limit:.2f} с'
            over += 1
        print(f'  {s:7.2f}-{e:7.2f}  {rate:+3d}%  {shown(text)[:60]}{flag}')
        i0 = int(s * SR)
        track[i0:i0 + len(x)] += x
        segs.append((s, e, shown(text)))
    if over:
        print(f'  фраз не влезло: {over}')
    return compress(track[:int(total * SR)]), segs


def moving_avg(x, w):
    c = np.cumsum(np.concatenate([[0.0], x]))
    y = (c[w:] - c[:-w]) / w
    return np.concatenate([np.full(w // 2, y[0]), y, np.full(len(x) - len(y) - w // 2, y[-1])])


def compress(x, thr=0.13, ratio=3.0):
    """Лёгкая компрессия голоса: громкие слоги тише, фразы ровнее, ограничителю меньше работы."""
    env = np.sqrt(moving_avg(x ** 2, int(0.015 * SR)))
    gain = np.minimum(1.0, (np.maximum(env, 1e-9) / thr) ** (1 / ratio - 1))
    return x * moving_avg(gain, int(0.03 * SR))


def duck(segs, n, depth):
    """Огибающая для музыки: под голосом — depth, между фразами — 1, переходы сглажены."""
    act = np.zeros(n)
    for s, e, _ in segs:
        act[int(max(0, s - 0.2) * SR):int((e + 0.3) * SR)] = 1
    w = int(0.4 * SR)
    c = np.cumsum(np.concatenate([[0.0], act]))
    sm = (c[w:] - c[:-w]) / w
    sm = np.concatenate([np.zeros(w // 2), sm, np.zeros(n - len(sm) - w // 2)])
    return 1 - (1 - depth) * sm


def write_srt(path, segs):
    def ts(t):
        ms = int(round(t * 1000))
        return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
    with open(path, 'w', encoding='utf8') as f:
        for k, (s, e, text) in enumerate(segs, 1):
            f.write(f'{k}\n{ts(s)} --> {ts(e)}\n{text}\n\n')


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf8', errors='replace')
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)[-1])
    peak = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r.stderr)[-1])
    return i, peak


def master(st, path, target=-14.0):
    """Довести до target LUFS (стандарт YouTube и VK) и мягко ограничить пики на −1,5 дБ."""
    st = st * 0.5 / max(1e-6, np.max(np.abs(st)))
    write_wav(path, st)
    for _ in range(2):
        i, _p = loudness(path)
        st = st * 10 ** ((target - i) / 20)
        thr, ceil = 0.66, 0.84
        a = np.abs(st)
        hot = a > thr
        st[hot] = np.sign(st[hot]) * (thr + (ceil - thr) * np.tanh((a[hot] - thr) / (ceil - thr)))
        write_wav(path, st)
    i, p = loudness(path)
    print(f'  {os.path.basename(path)}: {i:.1f} LUFS, пик {p:.1f} dBFS, под ограничителем {100 * hot.mean():.3f}% отсчётов')
    return st


def write_wav(path, st):
    data = (np.clip(st, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ---------- сборка ----------
def main():
    args = sys.argv[2:]
    preview = None
    if '--preview' in args:
        preview = [float(x) for x in args[args.index('--preview') + 1].split(',')]
    audio_only = '--audio-only' in args
    voice = VOICES[args[args.index('--voice') + 1]] if '--voice' in args else VOICES['dmitry']
    parts = json.load(open(REC + '/parts.json', encoding='utf8'))
    if not audio_only:
        os.makedirs(LAYERS, exist_ok=True)
        spec_path = BUILD + '/layers-spec.json'
        json.dump(layer_spec(parts), open(spec_path, 'w', encoding='utf8'), ensure_ascii=False)
        npx = 'npx.cmd' if os.name == 'nt' else 'npx'
        subprocess.run([npx, 'tsx', 'scripts/demo-layers.ts', spec_path, LAYERS], check=True, cwd=ROOT)
        make_static()
    scenes, total = timeline(parts)
    print(f'длительность: {total:.1f} с ({int(total // 60)}:{int(total % 60):02d})')
    for kind, idx, start, dur in scenes:
        print(f'  {start:7.1f}  {dur:5.1f}  {kind} {parts[idx]["name"] if idx is not None else ""}')

    if preview:
        init(REC)
        os.makedirs(BUILD + '/preview', exist_ok=True)
        for s in preview:
            render(int(s * FPS)).save(f'{BUILD}/preview/{s:06.1f}.jpg', quality=88)
        print('превью:', BUILD + '/preview')
        return

    video = BUILD + '/video.mp4'
    if audio_only:
        if not os.path.exists(video):
            sys.exit('нет build/video.mp4 — сначала полная сборка')
    else:
        nframes = int(total * FPS)
        workers = max(2, min(22, (os.cpu_count() or 4) - 4))
        chunks = workers * 2
        bounds = [round(nframes * k / chunks) for k in range(chunks + 1)]
        jobs = [(REC, bounds[k], bounds[k + 1], f'{BUILD}/chunk{k:03d}.mp4') for k in range(chunks)]
        todo = jobs
        if '--from' in args:
            # Перерисовать только конец ролика, начало взять из прошлой сборки (те же куски, те же границы).
            first = int(float(args[args.index('--from') + 1]) * FPS)
            todo = [j for j in jobs if j[2] > first]
            missing = [j[3] for j in jobs if j not in todo and not os.path.exists(j[3])]
            if missing:
                sys.exit(f'нет готовых кусков из прошлой сборки: {missing[:3]}')
            print(f'перерисовываю {len(todo)} из {chunks} кусков')
        with Pool(workers) as pool:
            for n, out in enumerate(pool.imap(render_chunk, todo), 1):
                print(f'\r  кусков: {n}/{len(todo)}', end='', flush=True)
        print()
        with open(BUILD + '/chunks.txt', 'w', encoding='utf8') as f:
            for _, _, _, out in jobs:
                f.write(f"file '{out}'\n")
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', BUILD + '/chunks.txt', '-c', 'copy', video], check=True)

    def mux(wav, out):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
                        '-movflags', '+faststart', out], check=True)
        print('готово:', out)

    if '--no-music' in args:
        os.replace(video, REC + '/dekanat-24-7-demo.mp4')
        return

    # Музыка: ритм — от первой главы до финала.
    events = []
    for kind, idx, start, dur in scenes[1:]:
        events.append(('whoosh', start + XF / 2))
    for kind, idx, start, dur in scenes:
        if kind == 'part':
            p = parts[idx]
            for tp in p['taps']:
                events.append(('tick', start + tp['at'] - p['start']))
    beat_from = next(s for k, _, s, _ in scenes if k == 'chapter')
    beat_to = next(s for k, _, s, _ in scenes if k == 'outro') + 1.0
    mus = music(total, events, beat_from, beat_to)

    # Вариант без голоса: одна музыка.
    wav = BUILD + '/audio-music.wav'
    master(mus.copy(), wav)
    mux(wav, REC + '/dekanat-24-7-demo-music.mp4')
    if '--no-voice' in args:
        return

    # Вариант с голосом: музыка тише голоса на 7 дБ между фразами и ещё на 8 дБ под фразами.
    print(f'озвучка: {voice}')
    vo, segs = narration(parts, scenes, total, voice)
    n = min(len(vo), len(mus))
    vo, mus = vo[:n], mus[:n]
    v_rms = np.sqrt(np.mean(vo[np.abs(vo) > 0.02] ** 2))
    m_rms = np.sqrt(np.mean(mus ** 2))
    bed = mus * (v_rms * 10 ** (-7 / 20) / m_rms) * duck(segs, n, 10 ** (-8 / 20))[:, None]
    mix = bed + vo[:, None]
    wav = BUILD + '/audio-voice.wav'
    master(mix, wav)
    mux(wav, REC + '/dekanat-24-7-demo.mp4')
    write_srt(REC + '/dekanat-24-7-demo.srt', segs)
    print('субтитры:', REC + '/dekanat-24-7-demo.srt')


if __name__ == '__main__':
    main()
