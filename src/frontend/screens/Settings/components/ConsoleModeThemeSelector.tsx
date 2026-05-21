import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectField } from 'frontend/components/UI'
import { MenuItem } from '@mui/material'
import { SelectChangeEvent } from '@mui/material/Select'
import { configStore } from 'frontend/helpers/electronStores'

const ConsoleModeThemeSelector = () => {
  const { t } = useTranslation()
  const [consoleTheme, setConsoleTheme] = useState<string>(
    () => (configStore.get_nodefault('consoleTheme') as string) ?? 'dusty'
  )

  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value
    configStore.set('consoleTheme', value)
    setConsoleTheme(value)
  }

  return (
    <SelectField
      htmlId="console_theme_selector"
      label={t('setting.console_theme', 'Tema del Modo Consola')}
      onChange={handleChange}
      value={consoleTheme}
    >
      <MenuItem value="dusty">🎮 Dusty</MenuItem>
      <MenuItem value="classic">📋 Clásico</MenuItem>
    </SelectField>
  )
}

export default ConsoleModeThemeSelector
