import { useEffect, useState } from 'react'
import { FolderOpen, ScrollText, ShieldCheck, RotateCcw } from 'lucide-react'
import { ACTIONS } from '@shared/actions'
import { ALL_KINDS, KIND_LABEL } from '@shared/fileKinds'
import { MAX_FAVORITES } from '@shared/defaults'
import type { FileKind, OutputMode, QualityPreset, Settings, ThemePref, ToolStatus } from '@shared/types'
import { useDark } from '../lib/useDark'
import { Icon, KIND_ICON } from '../lib/icons'
import { Row, Section, Segmented, Toggle } from './controls'

const api = window.tangerine

const SOURCE_LABEL: Record<ToolStatus['source'], string> = {
  bundled: 'Bundled', system: 'Installed', override: 'Custom', missing: 'Missing'
}

export function SettingsApp() {
  useDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [s, setS] = useState<Settings | null>(null)
  const [tools, setTools] = useState<ToolStatus[]>([])

  useEffect(() => {
    void api.getSettings().then(setS)
    void api.toolsStatus().then(setTools)
    return api.onSettingsChanged((next) => {
      setS(next)
      void api.toolsStatus().then(setTools)
    })
  }, [])

  if (!s) return null
  const update = (patch: Partial<Settings>) => void api.setSettings(patch).then(setS)

  const setFavorite = (kind: FileKind, slot: number, id: string) => {
    const list = [...(s.favorites[kind] ?? [])]
    if (id) list[slot] = id
    else list.splice(slot, 1)
    update({ favorites: { ...s.favorites, [kind]: list.filter(Boolean) } })
  }

  const preview = `photo${s.suffix}.png`

  return (
    <div className="settings">
      <header className="settings-head">
        <img src="./tangerine.svg" alt="" width={36} height={36} onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div>
          <h1>Tangerine</h1>
          <p>Hold <kbd>Shift</kbd> and drag any file to open the menu. Add <kbd>Ctrl</kbd> with several files for batch.</p>
        </div>
        <span className="local-badge" title="No file ever leaves this PC">
          <ShieldCheck size={16} /> 100% Local Processing
        </span>
      </header>

      <main className="settings-body">
        <Section title="General">
          <Row label="Launch on startup" hint="Start quietly in the system tray when you sign in.">
            <Toggle label="Launch on startup" checked={s.launchOnStartup} onChange={(v) => update({ launchOnStartup: v })} />
          </Row>
          <Row label="Shift-drag menu" hint="Show the radial menu when you Shift-drag a file.">
            <Toggle label="Shift-drag menu" checked={s.shiftDragEnabled} onChange={(v) => update({ shiftDragEnabled: v })} />
          </Row>
          <Row label="Appearance">
            <Segmented<ThemePref> label="Theme" value={s.theme} onChange={(v) => update({ theme: v })}
              options={[{ value: 'system', label: 'System' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
          </Row>
          <Row label="Check for updates" hint="The only network request Tangerine ever makes. No telemetry.">
            <Toggle label="Check for updates" checked={s.checkForUpdates} onChange={(v) => update({ checkForUpdates: v })} />
          </Row>
        </Section>

        <Section title="Output">
          <Row label="Save converted files to">
            <Segmented<OutputMode> label="Output folder" value={s.outputMode} onChange={(v) => update({ outputMode: v })}
              options={[
                { value: 'desktop', label: 'Desktop' },
                { value: 'source', label: 'Next to original' },
                { value: 'custom', label: 'Folder…' },
                { value: 'ask', label: 'Ask each time' }
              ]} />
          </Row>
          {s.outputMode === 'custom' && (
            <Row label="Folder" hint={s.customOutputDir || 'No folder chosen — Desktop is used.'}>
              <button className="btn" onClick={async () => {
                const dir = await api.pickFolder()
                if (dir) update({ customOutputDir: dir })
              }}>
                <FolderOpen size={16} /> Browse…
              </button>
            </Row>
          )}
          <Row label="File name suffix" hint={<>Example: <code>{preview}</code></>}>
            <input className="input" value={s.suffix} maxLength={40} onChange={(e) => update({ suffix: e.target.value })} aria-label="File name suffix" />
          </Row>
        </Section>

        <Section title="Quality preset" description="Applies to every conversion: image quality, video CRF, audio bitrate and PDF compression level.">
          <Row label="Preset">
            <Segmented<QualityPreset> label="Quality" value={s.quality} onChange={(v) => update({ quality: v })}
              options={[{ value: 'high', label: 'High quality' }, { value: 'balanced', label: 'Balanced' }, { value: 'small', label: 'Smallest file' }]} />
          </Row>
        </Section>

        <Section title="File types" description="Turn off file types you never want the menu to appear for.">
          {ALL_KINDS.map((k) => (
            <Row key={k} label={KIND_LABEL[k]}>
              <Toggle label={KIND_LABEL[k]} checked={s.enabledKinds[k]} onChange={(v) => update({ enabledKinds: { ...s.enabledKinds, [k]: v } })} />
            </Row>
          ))}
        </Section>

        <Section title="Favorites" description={`Pin up to ${MAX_FAVORITES} actions per file type to the inner ring for one-motion access.`}>
          {ALL_KINDS.map((k) => {
            const options = ACTIONS.filter((a) => a.kind === k)
            const current = s.favorites[k] ?? []
            return (
              <div className="fav-row" key={k}>
                <span className="fav-kind"><Icon name={KIND_ICON[k]} size={16} /> {KIND_LABEL[k]}</span>
                <div className="fav-slots">
                  {Array.from({ length: MAX_FAVORITES }, (_, i) => (
                    <select key={i} className="input" value={current[i] ?? ''} aria-label={`${KIND_LABEL[k]} favorite ${i + 1}`}
                      disabled={i > current.length} onChange={(e) => setFavorite(k, i, e.target.value)}>
                      <option value="">—</option>
                      {options.map((a) => (
                        <option key={a.id} value={a.id} disabled={current.includes(a.id) && current[i] !== a.id}>{a.hint}</option>
                      ))}
                    </select>
                  ))}
                </div>
              </div>
            )
          })}
        </Section>

        <Section title="Windows integration">
          <Row label="Explorer right-click menu" hint={'Adds "Convert with Tangerine". On Windows 11 it appears under "Show more options".'}>
            <Toggle label="Explorer right-click menu" checked={s.contextMenu} onChange={(v) => update({ contextMenu: v })} />
          </Row>
        </Section>

        <Section title="Tools" description="Conversions run with these local programs. Ghostscript and LibreOffice are detected from their standard install folders.">
          <table className="tools">
            <thead><tr><th>Tool</th><th>Used for</th><th>Status</th><th /></tr></thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.name}>
                  <td><strong>{t.label}</strong><small title={t.path ?? ''}>{t.path ?? 'Not found'}</small></td>
                  <td>{t.requiredFor}</td>
                  <td><span className={`chip chip-${t.source}`}>{SOURCE_LABEL[t.source]}</span></td>
                  <td className="tool-actions">
                    <button className="btn btn-sm" onClick={async () => {
                      const p = await api.pickFile(t.name)
                      if (p) update({ toolPaths: { ...s.toolPaths, [t.name]: p } })
                    }}>Locate…</button>
                    {s.toolPaths[t.name] && (
                      <button className="btn btn-sm btn-ghost" title="Use default" aria-label={`Reset ${t.label}`} onClick={() => {
                        const next = { ...s.toolPaths }
                        delete next[t.name]
                        update({ toolPaths: next })
                      }}><RotateCcw size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Privacy & diagnostics">
          <div className="privacy">
            <ShieldCheck size={28} />
            <div>
              <strong>100% Local Processing</strong>
              <p>Files are converted on this PC by bundled tools. Nothing is uploaded, and Tangerine has no telemetry or analytics.</p>
            </div>
          </div>
          <Row label="Logs" hint="Useful when a conversion fails.">
            <button className="btn" onClick={() => api.openLogs()}><ScrollText size={16} /> Open Logs</button>
          </Row>
        </Section>
      </main>
    </div>
  )
}
