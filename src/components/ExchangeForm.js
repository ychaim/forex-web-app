import React, { useState, useReducer, useMemo, useEffect, useRef } from 'react'
import Dinero from 'dinero.js'
import { handleActions } from '../utils/redux'
import useForex from '../hooks/forex'
import { usePocket } from '../hooks/pockets'
import { CURRENCIES } from '../constants'

const useFormState = (...args) => {
  const [state, setter] = useState(...args)
  const handler = event => {
    if (event && event.target && event.target.value)
      return setter(event.target.value)
    return setter(event)
  }
  return [state, handler]
}

const CurrencySelector = ({ except, ...props }) => (
  <select {...props}>
    {CURRENCIES.filter(value => value !== except).map(value => (
      <option value={value} key={value}>
        {value}
      </option>
    ))}
  </select>
)

const format = dinero => {
  const precision = dinero.getPrecision()
  const format = precision ? `0.${'0'.repeat(precision)}` : '0'
  return dinero.toFormat(format)
}

const toInteger = (value, precision = 2) => {
  if (typeof value === 'number') return toInteger(value.toFixed(precision))
  return value.replace('.', '') | 0
}

const reducer = handleActions({
  focus: (state, { source }) => {
    return { ...state, source }
  },
  input: ({ rate: r }, { value, rate = r }) => {
    const inputValue = Dinero({ amount: toInteger(value) })
    const outputValue = inputValue.multiply(rate)
    return { source: 'input', rate, inputValue, outputValue }
  },
  output: ({ rate: r }, { value, rate = r }) => {
    const outputValue = Dinero({ amount: toInteger(value) })
    const inputValue = outputValue.divide(rate)
    return { source: 'output', rate, inputValue, outputValue }
  },
  forex: ({ source, [`${source}Value`]: dinero }, { rate }) => {
    return reducer({ rate }, { type: source, value: dinero.toUnit() })
  },
})

const useInitialState = (value, rate = 0) => {
  const action = { type: 'input', value }
  return useMemo(() => reducer({ rate }, action), [value, rate])
}

const useForexForm = (initialValue, rate) => {
  const initialState = useInitialState(initialValue, rate)
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (typeof rate !== 'number') return
    dispatch({ type: 'forex', rate })
  }, [rate])

  const forms = {
    input: {
      ref: useRef(),
      value: format(state.inputValue),
      onChange: e => dispatch({ type: 'input', value: e.target.value }),
      onFocus: () => dispatch({ type: 'focus', source: 'input' }),
    },
    output: {
      ref: useRef(),
      value: format(state.outputValue),
      onChange: e => dispatch({ type: 'output', value: e.target.value }),
      onFocus: () => dispatch({ type: 'focus', source: 'output' }),
    },
  }

  const reset = (value = initialValue) => {
    dispatch({ type: 'input', value, rate })
    if (forms[state.source].ref.current) forms[state.source].ref.current.focus()
  }

  return [state.inputValue.toUnit(), reset, forms]
}

const ExchangeForm = ({ initialAmount = 10 }) => {
  const [from, setFrom] = useFormState('GBP')
  const [to, setTo] = useFormState('EUR')
  const [rate, { online, error }] = useForex(from, to)
  const [amount, reset, forms] = useForexForm(initialAmount, rate)
  const [available, { exchange }] = usePocket(from)
  const overdraft = amount > available
  const enabled = online && !error && !overdraft && amount > 0

  const handleSubmit = event => {
    event.preventDefault()
    exchange({ to, amount, rate })
    reset()
  }

  const flip = event => {
    event.preventDefault()
    event.stopPropagation()
    const current = { to, from }
    setTo(current.from)
    setFrom(current.to)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex' }}>
        <CurrencySelector value={from} onChange={setFrom} except={to} />
        <input {...forms.input} pattern='\d{1,}(\.\d{2})?' />
        <small>balance: {available}</small>
      </div>
      <br />
      <button onClick={flip} type='button'>
        FLIP
      </button>
      <br />
      <div style={{ display: 'flex' }}>
        <CurrencySelector value={to} onChange={setTo} except={from} />
        <input {...forms.output} pattern='\d{1,}(\.\d{2})?' />
      </div>
      <br />
      <button type='submit' disabled={!enabled}>
        {overdraft ? 'OVERDRAFT!' : 'exchange'}
      </button>
    </form>
  )
}

export default ExchangeForm