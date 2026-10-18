import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Overlay } from './overlay/Overlay'
import { SettingsApp } from './settings/Settings'
import { Toast } from './toast/Toast'

const route = window.location.hash.replace(/^#\/?/, '') || 'settings'
document.documentElement.dataset.route = route

const View = route === 'overlay' ? Overlay : route === 'toast' ? Toast : SettingsApp

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <View />
  </StrictMode>
)
