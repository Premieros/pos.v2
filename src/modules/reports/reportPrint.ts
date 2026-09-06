export function printCurrentReport() {
  document.body.classList.add('report-print-mode')
  const clear = () => document.body.classList.remove('report-print-mode')
  window.addEventListener('afterprint', clear, { once: true })
  window.print()
  window.setTimeout(clear, 1000)
}
