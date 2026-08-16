import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = 'dist/index.html'
const outputPath = 'dist/home-cwv.html'

const criticalCss = `
:root{--paper:#f2eee7;--white:#fffaf2;--accent:#a84f2a;--pad:clamp(20px,4.2vw,72px)}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--paper)}
body{overflow-x:hidden;font-family:Arial,sans-serif}
img{display:block;max-width:100%}
.hero{height:100svh;min-height:690px;position:relative;color:var(--white);overflow:hidden}
.hero-picture{display:block;width:100%;height:100%}
.hero-image{width:100%;height:100%;object-fit:cover;object-position:center 44%;transform:none;animation:none}
.hero-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(22,16,12,.8) 0%,rgba(25,17,12,.35) 52%,rgba(20,14,11,.1) 100%),linear-gradient(0deg,rgba(19,13,9,.46),transparent 44%)}
.hero-content{position:absolute;z-index:2;left:var(--pad);bottom:clamp(150px,19vh,210px);max-width:810px}
.hero-content h1{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:clamp(48px,7vw,105px);line-height:.99;letter-spacing:-.04em;margin:19px 0 26px}
.hero-content h1 em{font-weight:400;color:#ddad8b}
.hero-in{opacity:1!important;transform:none!important;animation:none!important}
.eyebrow{font-size:11px;line-height:1.4;letter-spacing:.18em;text-transform:uppercase;font-weight:600}
.hero-copy{max-width:570px;font-size:clamp(14px,1.25vw,18px);line-height:1.65;color:rgba(255,250,242,.82)}
.hero-cta{display:flex;align-items:center;gap:28px;margin-top:34px}
.hero-cta a{color:inherit;text-decoration:none}
.hero-cta .btn{min-height:49px;padding:0 22px;display:inline-flex;align-items:center;justify-content:center;gap:14px;border-radius:100px;background:var(--accent);font-size:12px;font-weight:600}
.hero-facts{position:absolute;z-index:2;left:var(--pad);right:var(--pad);bottom:32px;border-top:1px solid rgba(255,255,255,.35);display:grid;grid-template-columns:repeat(3,1fr);padding-top:23px}
.hero-facts span{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.72)}
.hero-facts b{color:var(--white);font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:400;text-transform:none;letter-spacing:0;margin-right:8px}
.scroll-cue{display:none}
@media(max-width:720px){
  :root{--pad:20px}
  .hero{min-height:680px}
  .hero-image{object-position:62% center}
  .hero-shade{background:linear-gradient(0deg,rgba(20,13,10,.83),rgba(20,13,10,.12) 78%)}
  .hero-content{bottom:154px}
  .hero-content h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(43px,13vw,62px);margin:12px 0 19px}
  .hero-copy{font-size:13px;line-height:1.55}
  .hero-cta{gap:20px;margin-top:24px}
  .hero-cta .btn{padding:0 17px}
  .hero-facts{grid-template-columns:repeat(3,1fr);gap:10px;bottom:24px}
  .hero-facts span{font-size:7px;line-height:1.5}
  .hero-facts b{display:block;font-size:17px}
}
`

let html = await readFile(sourcePath, 'utf8')

const stylesheetTag = html.match(
  /<link\b[^>]*href=["'](\/assets\/main-[^"']+\.css)["'][^>]*>/i,
)

if (!stylesheetTag) {
  throw new Error('Main Vite stylesheet link was not found in dist/index.html')
}

const tag = stylesheetTag[0]
const href = stylesheetTag[1]

if (!/\brel=["']stylesheet["']/i.test(tag)) {
  throw new Error(`Matched main CSS tag is not rel=stylesheet: ${tag}`)
}

const asyncCss = [
  `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">`,
  `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
].join('\n    ')

html = html.replace(tag, asyncCss)

if (!html.includes('id="ozelif-home-critical-css"')) {
  html = html.replace(
    '</head>',
    `    <style id="ozelif-home-critical-css">${criticalCss}</style>\n    <!-- ozelif-home-cwv -->\n</head>`,
  )
}

await writeFile(outputPath, html, 'utf8')
console.log(`Created ${outputPath} with critical Hero CSS and async ${href}`)
