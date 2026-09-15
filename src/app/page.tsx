import { chapters } from '@/content'
import { Hero } from '@/components/Hero'
import { Chapter } from '@/components/Chapter'
import { Kitchens } from '@/components/Kitchens'
import { Marquee } from '@/components/Marquee'
import { Menu } from '@/components/Menu'
import { Nights } from '@/components/Nights'
import { Veranda } from '@/components/Veranda'
import { Rating } from '@/components/Rating'
import { Booking } from '@/components/Booking'
import { Footer } from '@/components/Footer'

/**
 * Порядок секций = порядок кадров камеры (data-cam). Меняя порядок здесь,
 * менять и KEYFRAMES в components/scene/keyframes.ts.
 */
export default function Page() {
  return (
    <>
      <Hero />
      {/* слева в кадре длинный павильон — текст справа, над открытой площадью */}
      <Chapter id="park" cam={1} align="right" {...chapters.park} />
      {/* буквы LOFT PARK в кадре справа — текст слева */}
      <Chapter cam={2} align="left" {...chapters.facade} />
      <Chapter cam={3} align="left" {...chapters.loft} />
      <Kitchens />
      <Marquee />
      <Menu />
      <Nights />
      <Veranda />
      <Rating />
      <Booking />
      <Footer />
    </>
  )
}
