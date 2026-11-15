// Страница плавно появляется при переходе между разделами (анимация page-in в globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
