import { useId } from 'react'
import { Popover } from 'antd-mobile'
import { CheckOutline, DownOutline } from 'antd-mobile-icons'
import './AiFilterDropdown.css'

type AiFilterDropdownProps<Value extends string> = {
  label: string
  options: readonly { label: string; value: Value }[]
  value: Value
  visible: boolean
  placement?: 'bottom-start' | 'bottom-end'
  onVisibleChange: (visible: boolean) => void
  onChange: (value: Value) => void
}

export function AiFilterDropdown<Value extends string>({
  label,
  options,
  value,
  visible,
  placement = 'bottom-start',
  onVisibleChange,
  onChange,
}: AiFilterDropdownProps<Value>) {
  const menuId = useId()
  const valueLabel = options.find(option => option.value === value)?.label ?? value

  return (
    <div className="ai-filter-dropdown">
      {/* 菜单留在 AI 区域内，既不会被工作区盖住，也沿用工作区的滚动条样式。 */}
      <Popover
        className="ai-filter-dropdown__popover"
        content={(
          <div aria-label={`选择${label}`} className="ai-filter-dropdown__list" id={menuId} role="group">
            {options.map(option => (
              <button
                aria-pressed={option.value === value}
                className="ai-filter-dropdown__option"
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  onVisibleChange(false)
                }}
              >
                <span title={option.label}>{option.label}</span>
                {option.value === value && <CheckOutline aria-hidden="true" width={16} height={16} />}
              </button>
            ))}
          </div>
        )}
        destroyOnHide
        getContainer={null}
        placement={placement}
        trigger="click"
        visible={visible}
        onVisibleChange={onVisibleChange}
      >
        <button
          aria-controls={visible ? menuId : undefined}
          aria-expanded={visible}
          className="ai-filter-dropdown__trigger"
          type="button"
        >
          <span className="ai-filter-dropdown__label">{label}</span>
          <span className="ai-filter-dropdown__value" title={valueLabel}>{valueLabel}</span>
          <DownOutline aria-hidden="true" width={12} height={12} />
        </button>
      </Popover>
    </div>
  )
}
