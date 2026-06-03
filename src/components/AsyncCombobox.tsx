import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCombobox } from 'downshift'

import { clasesInacap } from '../lib/theme'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

type AsyncComboboxProps<TItem> = {
  value: number | null
  onChange: (id: number | null, item: TItem | null) => void
  fetchOptions: (search: string) => Promise<TItem[]>
  getOptionLabel: (item: TItem) => string
  getOptionId: (item: TItem) => number
  placeholder?: string
  disabled?: boolean
  id?: string
  selectedItem?: TItem | null
}

export function AsyncCombobox<TItem>({
  value,
  onChange,
  fetchOptions,
  getOptionLabel,
  getOptionId,
  placeholder = 'Buscar y seleccionar...',
  disabled = false,
  id,
  selectedItem,
}: AsyncComboboxProps<TItem>) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [inputValue, setInputValue] = useState('')
  const debouncedSearch = useDebouncedValue(inputValue, 300)

  const optionsQuery = useQuery({
    queryKey: ['async-combobox', inputId, debouncedSearch],
    queryFn: () => fetchOptions(debouncedSearch),
    enabled: false,
  })

  const options = optionsQuery.data ?? []
  const resolvedSelectedItem = useMemo(() => {
    if (value === null) return null
    if (selectedItem && getOptionId(selectedItem) === value) return selectedItem
    return options.find((option) => getOptionId(option) === value) ?? null
  }, [getOptionId, options, selectedItem, value])

  const selectedLabel = resolvedSelectedItem ? getOptionLabel(resolvedSelectedItem) : ''

  const {
    closeMenu,
    getInputProps,
    getItemProps,
    getLabelProps,
    getMenuProps,
    getToggleButtonProps,
    highlightedIndex,
    isOpen,
    openMenu,
  } = useCombobox<TItem>({
    inputId,
    items: options,
    itemToString: (item) => (item ? getOptionLabel(item) : ''),
    selectedItem: resolvedSelectedItem,
    inputValue,
    onInputValueChange: ({ inputValue: nextInputValue, type }) => {
      const nextValue = nextInputValue ?? ''
      setInputValue(nextValue)

      if (
        type === useCombobox.stateChangeTypes.InputChange &&
        value !== null &&
        selectedLabel &&
        nextValue !== selectedLabel
      ) {
        onChange(null, null)
      }
    },
    onIsOpenChange: ({ isOpen: nextIsOpen }) => {
      if (nextIsOpen) {
        void optionsQuery.refetch()
      }
    },
    onSelectedItemChange: ({ selectedItem: nextSelectedItem }) => {
      if (!nextSelectedItem) return
      setInputValue(getOptionLabel(nextSelectedItem))
      onChange(getOptionId(nextSelectedItem), nextSelectedItem)
      closeMenu()
    },
  })

  useEffect(() => {
    if (value !== null && resolvedSelectedItem) {
      const label = getOptionLabel(resolvedSelectedItem)
      setInputValue(label)
    }
  }, [getOptionLabel, resolvedSelectedItem, value])

  useEffect(() => {
    if (isOpen) {
      void optionsQuery.refetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isOpen])

  const showLoading = isOpen && optionsQuery.isFetching
  const showNoResults = isOpen && !optionsQuery.isFetching && options.length === 0

  function clearSelection() {
    setInputValue('')
    onChange(null, null)
    closeMenu()
  }

  return (
    <div className="relative">
      <label {...getLabelProps()} className="sr-only" htmlFor={inputId}>
        {placeholder}
      </label>
      <div className="relative">
        <input
          {...getInputProps({
            disabled,
            id: inputId,
            onFocus: () => openMenu(),
            placeholder,
          })}
          className={`w-full rounded-2xl border border-slate-300 bg-white py-3 pl-4 pr-20 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${clasesInacap.focoMarca}`}
          type="text"
        />
        {value !== null && !disabled ? (
          <button
            aria-label="Limpiar selección"
            className="absolute right-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={clearSelection}
            type="button"
          >
            ×
          </button>
        ) : null}
        <button
          {...getToggleButtonProps({ disabled })}
          aria-label="Mostrar opciones"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      <ul
        {...getMenuProps()}
        className={`absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 text-sm shadow-xl ${
          isOpen ? 'block' : 'hidden'
        }`}
      >
        {showLoading ? <li className="px-4 py-3 text-slate-500">Buscando...</li> : null}
        {showNoResults ? <li className="px-4 py-3 text-slate-500">Sin resultados</li> : null}
        {isOpen && !showLoading
          ? options.map((item, index) => {
              const optionId = getOptionId(item)
              const isSelected = optionId === value
              const isHighlighted = highlightedIndex === index

              return (
                <li
                  className={`cursor-pointer px-4 py-3 transition ${
                    isHighlighted ? 'bg-red-50 text-[#E30613]' : 'text-slate-700'
                  } ${isSelected ? 'font-semibold' : ''}`}
                  key={optionId}
                  {...getItemProps({ item, index })}
                >
                  {getOptionLabel(item)}
                </li>
              )
            })
          : null}
      </ul>
    </div>
  )
}
