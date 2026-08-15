export const SITE = 'https://ozelifkoja.ru'
export const telegram = 'https://t.me/ozelifleather'
export const whatsapp = 'https://api.whatsapp.com/send/?phone=79033707854&type=phone_number&app_absent=0'

// Эти разделы уже реализованы в текущем приложении. Не отправляем посетителя
// на старый сайт, даже когда ссылка строится из общего списка категорий.
const localRoutes = new Set(['/odejnayakozha', '/dublyonka', '/zamsha', '/obuvnayakozha', '/galantereynayakozha', '/furnitura'])

export const categories = [
  { title: 'Одежная кожа', href: '/odejnayakozha', image: '/images/categories/clothing-leather.webp', imageAvif: '/images/categories/clothing-leather.avif', imagePosition: 'center 58%', alt: 'Мягкая одежная кожа коричневых оттенков', copy: 'Мягкий и практичный материал для верхней одежды, головных уборов и аксессуаров.' },
  { title: 'Дублёночный материал', href: '/dublyonka', image: '/images/categories/shearling-material.webp', imageAvif: '/images/categories/shearling-material.avif', imagePosition: 'center 55%', alt: 'Дублёночный материал с мягким светлым мехом', copy: 'Меринос, тоскана, керли и другие виды мехового материала.' },
  { title: 'Замша', href: '/zamsha', image: '/images/categories/suede.webp', imageAvif: '/images/categories/suede.avif', imagePosition: 'center 52%', alt: 'Замша тёплых коричневых и терракотовых оттенков', copy: 'Бархатистая фактура для одежды, обуви и выразительных деталей.' },
  { title: 'Обувная кожа', href: '/obuvnayakozha', image: '/images/categories/shoe-leather.webp', imageAvif: '/images/categories/shoe-leather.avif', imagePosition: 'center 61%', alt: 'Обувная кожа рядом с обувными колодками', copy: 'Материал для верха и низа обуви с прочной выделкой.' },
  { title: 'Галантерейная кожа', href: '/galantereynayakozha', image: '/images/categories/leather-goods.webp', imageAvif: '/images/categories/leather-goods.avif', imagePosition: 'center 57%', alt: 'Галантерейная кожа для сумок, ремней и аксессуаров', copy: 'Для сумок, ремней, кошельков и малых кожаных изделий.' },
  { title: 'Фурнитура', href: '/furnitura', image: '/images/categories/hardware.webp', imageAvif: '/images/categories/hardware.avif', imagePosition: 'center 49%', alt: 'Металлическая фурнитура для изделий из кожи', copy: 'Комплектующие и детали для работы с кожей.' },
]

export const contacts = [
  { name: 'Элхан', role: 'Руководитель', phone: '+7 (985) 280-84-84', href: 'tel:+79852808484', note: 'Сотрудничество, жалобы и предложения' },
  { name: 'Рауль', role: 'Менеджер', phone: '+7 (960) 881-87-25', href: 'tel:+79608818725', note: 'Оформление заказа и другие вопросы' },
  { name: 'Эмилия', role: 'Менеджер', phone: '+7 (903) 370-78-54', href: 'tel:+79033707854', note: 'Консультация по материалам' },
]

export const external = (path: string) => path.startsWith('http') || path.startsWith('#') || localRoutes.has(path) ? path : `${SITE}${path}`
