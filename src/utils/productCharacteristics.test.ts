import { describe, expect, it } from 'vitest'
import { mergeProductDetails } from './productCharacteristics'

describe('product characteristics', () => {
  it('hides empty values from managed admin characteristics', () => {
    expect(mergeProductDetails({
      __managed: true,
      'Тип сырья': 'Овчина',
      'Цвет': '   ',
      'Размер шкур': '',
    }, [
      ['Цвет', 'Коричневый'],
      ['Размер шкур', '5–6 фут²'],
    ])).toEqual([
      ['Тип сырья', 'Овчина'],
    ])
  })

  it('merges imported attributes with static fallback before admin management', () => {
    expect(mergeProductDetails({
      color: 'Коричневый',
      thickness: null,
    }, [
      ['Тип сырья', 'Овчина'],
      ['Цвет', 'Коричневый'],
    ])).toEqual([
      ['Тип сырья', 'Овчина'],
      ['Цвет', 'Коричневый'],
    ])
  })
})