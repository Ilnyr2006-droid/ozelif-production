import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractCustomerProfileToolCalls,
  normalizeCustomerProfileUpdate,
} from './ai-customer-profile.mjs'

test('normalizes an explicitly extracted customer profile', () => {
  assert.deepEqual(
    normalizeCustomerProfileUpdate({
      name: ' Ильнур Касумов ',
      phone: '8 996 828-84-05',
    }),
    {
      name: 'Ильнур Касумов',
      phone: '+79968288405',
    },
  )
})

test('rejects product sizes as phone numbers', () => {
  assert.equal(
    normalizeCustomerProfileUpdate({
      name: null,
      phone: '51',
    }),
    null,
  )
})

test('extracts a structured function call', () => {
  const result = extractCustomerProfileToolCalls({
    output: [
      {
        type: 'function_call',
        name: 'capture_customer_profile',
        call_id: 'call_1',
        arguments: JSON.stringify({
          name: 'Ильнур',
          phone: '+7 996 828-84-05',
        }),
      },
    ],
  })

  assert.deepEqual(result.update, {
    name: 'Ильнур',
    phone: '+79968288405',
  })

  assert.equal(
    result.functionOutputs[0].type,
    'function_call_output',
  )
})
