import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ActionImpl, BuildContext, Step } from './types'

/** Pandoc reader names per extension. */
const PANDOC_FROM: Record<string, string> = {
  docx: 'docx', odt: 'odt', rtf: 'rtf', txt: 'markdown', md: 'gfm', markdown: 'gfm'
}

/**
 * LibreOffice headless. An isolated profile directory avoids the classic
 * "conversion silently does nothing" bug when the user already has LibreOffice open.
 */
function soffice(ctx: BuildContext, input: string, outDir: string): Step {
  const profile = pathToFileURL(path.join(ctx.tmpDir, 'lo-profile')).href
  return {
    tool: 'soffice',
    args: [`-env:UserInstallation=${profile}`, '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, input]
  }
}

export const documentActions: ActionImpl[] = [
  {
    id: 'doc.to-pdf',
    outputExt: () => 'pdf',
    build: (ctx) => {
      const loOut = path.join(ctx.tmpDir, 'lo-out')
      let source = ctx.inputs[0]!
      const steps: Step[] = []
      // Markdown is not a LibreOffice format: render it to DOCX with Pandoc first.
      if (ctx.inputExt === 'md' || ctx.inputExt === 'markdown') {
        const docx = path.join(ctx.tmpDir, 'from-markdown.docx')
        steps.push({ tool: 'pandoc', args: ['-f', 'gfm', '-t', 'docx', '-o', docx, source] })
        source = docx
      }
      steps.push(soffice(ctx, source, loOut))
      steps.push({ tool: '@move', args: [path.join(loOut, `${path.parse(source).name}.pdf`), ctx.output] })
      return steps
    }
  },
  {
    id: 'doc.to-md',
    outputExt: () => 'md',
    build: (ctx) => [{
      tool: 'pandoc',
      args: ['-f', PANDOC_FROM[ctx.inputExt] ?? 'docx', '-t', 'gfm', '--wrap=none', '-o', ctx.output, ctx.inputs[0]!]
    }]
  }
]
