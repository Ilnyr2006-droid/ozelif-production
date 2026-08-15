import { ArrowUpRight } from 'lucide-react'
import { external, whatsapp } from '../data'

export function Business() { return <>
  <section className="wholesale section"><div className="wholesale-title reveal"><p className="kicker">04 — Для бизнеса</p><h2>Оптовые условия<br/><em>начинаются с пачки</em></h2></div><div className="wholesale-body reveal"><div className="wholesale-number"><b>1000</b><span>дм² / одна пачка<br/>в зависимости от вида кожи</span></div><p>Перед покупкой можно посмотреть и выбрать подходящие пачки из партии. Размер скидки обсуждается индивидуально и зависит от объёма.</p><div className="button-row"><a className="btn btn--dark" href="/kozhaoptom">Условия для опта <ArrowUpRight size={17}/></a><a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">Связаться с менеджером</a></div></div></section>
  <section className="discount"><div className="discount-mark">500₽</div><div><p className="kicker">Для первого знакомства</p><h2>Скидка на первый заказ</h2><p>При первом заказе в магазине OZELIF — скидка 500 рублей.</p></div><a className="btn btn--light" href={external('/odejnayakozha')}>Перейти в каталог <ArrowUpRight size={17}/></a></section>
</> }
