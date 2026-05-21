import DustyMode from './DustyMode'
import ClassicMode from './ClassicMode'
import { configStore } from 'frontend/helpers/electronStores'

export default function ConsoleMode() {
  const consoleTheme = (configStore.get_nodefault('consoleTheme') as string) ?? 'dusty'
  if (consoleTheme === 'dusty') return <DustyMode />
  return <ClassicMode />
}
