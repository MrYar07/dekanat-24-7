# Склейка демо-видео из кадров scripts/record-demo.ts: фон, подписи, заставки, mp4 (H.264).
# Запуск: python scripts/compose-demo.py <папка записи>. Нужны ffmpeg и Pillow; шрифт — Segoe UI из Windows.
import json
import sys
import os
import subprocess
import textwrap
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1].replace(chr(92), '/').rstrip('/') + '/'
W, H = 1920, 1080
NAVY = (23, 42, 94)
INK = (242, 245, 251)
MUTED = (179, 191, 220)
AMBER = (224, 161, 0)
F_B = 'C:/Windows/Fonts/segoeuib.ttf'
F_R = 'C:/Windows/Fonts/segoeui.ttf'
F_I = 'C:/Windows/Fonts/segoeuii.ttf'
FPS = 30

parts = json.load(open(D + 'parts.json', encoding='utf8'))
LABEL = {
    '1-student': 'Студентка · телефон, 360 px',
    '2-teacher': 'Преподаватель · компьютер',
    '3-dean': 'Деканат · компьютер',
    '4-student': 'Студентка · телефон',
    '5-dean-answer': 'Деканат · компьютер',
    '6-student-answer': 'Студентка · телефон',
    '7-security': 'Другой студент · телефон',
}
os.makedirs(D + 'build', exist_ok=True)


def font(path, size):
    return ImageFont.truetype(path, size)


def banner(d):
    d.rectangle([0, 0, W, 44], fill=(243, 231, 205))
    d.text((40, 9), 'Концепт для конкурса MGIMO AI Challenge 2026. Не официальный сервис. Университет «Меридиан» и все данные вымышлены.',
           font=font(F_R, 22), fill=(125, 79, 0))


def background(kind, label):
    img = Image.new('RGB', (W, H), NAVY)
    d = ImageDraw.Draw(img)
    banner(d)
    if kind == 'phone':
        d.text((860, 120), 'Деканат 24/7', font=font(F_B, 40), fill=INK)
        d.text((860, 176), label, font=font(F_I, 30), fill=MUTED)
    else:
        d.text((224, 1030), 'Деканат 24/7', font=font(F_B, 28), fill=MUTED)
        d.text((420, 1033), '· ' + label, font=font(F_I, 24), fill=MUTED)
    return img


def caption_png(kind, text, path):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == 'phone':
        y = 330
        d.rectangle([860, y, 870, y + 60], fill=AMBER)
        for line in textwrap.wrap(text, 34):
            d.text((894, y), line, font=font(F_B, 50), fill=INK)
            y += 70
    else:
        lines = textwrap.wrap(text, 76)
        d.rectangle([224, 912, 232, 912 + 44], fill=AMBER)
        y = 904
        for line in lines:
            d.text((254, y), line, font=font(F_B, 40), fill=INK)
            y += 52
    img.save(path)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(out.stdout.strip())


def segment(i, p):
    kind = p['kind']
    bg = D + f'build/bg{i}.png'
    background(kind, LABEL[p['name']]).save(bg)
    dur = p['end']
    caps = p['captions']
    # Кадры screencast приходят только при изменениях: каждый держится до следующего.
    frames = p['frames']
    fl = D + f'build/frames{i}.txt'
    with open(fl, 'w', encoding='utf8') as f:
        for k, fr in enumerate(frames):
            start = 0 if k == 0 else fr['at']
            nxt = frames[k + 1]['at'] if k + 1 < len(frames) else dur
            f.write(f"file '{fr['file']}'\nduration {max(nxt - start, 0.001):.3f}\n")
        f.write(f"file '{frames[-1]['file']}'\n")
    inputs = ['-loop', '1', '-t', f'{dur:.2f}', '-i', bg, '-f', 'concat', '-safe', '0', '-i', fl]
    for j, c in enumerate(caps):
        cp = D + f'build/cap{i}-{j}.png'
        caption_png(kind, c['text'], cp)
        inputs += ['-loop', '1', '-t', f'{dur:.2f}', '-i', cp]
    if kind == 'phone':
        # 720×1560 → высота 980, слева
        vf = '[1:v]fps=30,scale=-2:980:flags=lanczos,setsar=1[v];[0:v][v]overlay=300:72[b0]'
    else:
        # 1920×1080 запись → 1600×900 сверху по центру
        vf = '[1:v]fps=30,scale=1472:828:flags=lanczos,setsar=1[v];[0:v][v]overlay=224:58[b0]'
    last = 'b0'
    for j, c in enumerate(caps):
        start = 0 if j == 0 else c['at']
        end = caps[j + 1]['at'] if j + 1 < len(caps) else dur + 1
        vf += f';[{last}][{j + 2}:v]overlay=0:0:enable=\'between(t,{start:.2f},{end:.2f})\'[b{j + 1}]'
        last = f'b{j + 1}'
    out = D + f'build/seg{i}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', vf, '-map', f'[{last}]', '-r', str(FPS),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-t', f'{dur:.2f}', out], check=True)
    return out


def card(name, lines, seconds):
    img = Image.new('RGB', (W, H), NAVY)
    d = ImageDraw.Draw(img)
    banner(d)
    y = 300
    for text, f, color, gap in lines:
        d.text((160, y), text, font=f, fill=color)
        y += gap
    png = D + f'build/{name}.png'
    img.save(png)
    out = D + f'build/{name}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-t', str(seconds), '-i', png, '-r', str(FPS),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-vf', 'fade=in:0:12', out], check=True)
    return out


intro = card('intro', [
    ('Деканат 24/7', font(F_B, 110), INK, 150),
    ('Личный кабинет студента вымышленного университета «Меридиан»', font(F_R, 46), INK, 80),
    ('Расписание, оценки, справки и связь с деканатом — в одном месте и с телефона', font(F_I, 38), MUTED, 120),
    ('Сделано с ИИ-агентом Claude Code · видео записано скриптом автоматически', font(F_R, 32), AMBER, 60),
], 6)
outro = card('outro', [
    ('Попробовать самому', font(F_B, 90), INK, 140),
    ('https://5-35-126-36.sslip.io', font(F_B, 54), INK, 80),
    ('Студенты student1 и student2, преподаватель teacher, деканат dean', font(F_R, 40), INK, 64),
    ('Пароль — в комментарии к конкурсной работе', font(F_R, 40), MUTED, 110),
    ('Код и описание процесса: github.com/MrYar07/dekanat-24-7', font(F_R, 36), AMBER, 60),
], 7)

segs = [segment(i, p) for i, p in enumerate(parts)]
lst = D + 'build/list.txt'
with open(lst, 'w', encoding='utf8') as f:
    for s in [intro, *segs, outro]:
        f.write(f"file '{s}'\n")
final = D + 'dekanat-24-7-demo.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', final], check=True)
print('ok', final, round(duration(final), 1), 's')
