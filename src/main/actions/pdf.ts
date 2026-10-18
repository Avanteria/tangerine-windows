import path from 'node:path'
import type { ActionImpl } from './types'
import { pick } from './types'

const GS_COMMON = ['-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER']

export const pdfActions: ActionImpl[] = [
  {
    id: 'pdf.compress',
    outputExt: () => 'pdf',
    build: (ctx) => [{
      tool: 'gs',
      args: [
        ...GS_COMMON, '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5',
        `-dPDFSETTINGS=${pick(ctx.quality, '/printer', '/ebook', '/screen')}`,
        '-dDetectDuplicateImages=true',
        `-sOutputFile=${ctx.output}`, ctx.inputs[0]!
      ]
    }]
  },
  {
    id: 'pdf.to-png',
    outputExt: () => '',
    outputIsDir: true,
    build: (ctx) => [{
      tool: 'gs',
      args: [
        ...GS_COMMON, '-sDEVICE=png16m', `-r${pick(ctx.quality, 200, 150, 96)}`,
        '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
        `-sOutputFile=${path.join(ctx.output, 'page-%03d.png')}`, ctx.inputs[0]!
      ]
    }]
  },
  {
    id: 'pdf.merge',
    outputExt: () => 'pdf',
    suffix: '_merged',
    build: (ctx) => [{ tool: 'qpdf', args: ['--empty', '--pages', ...ctx.inputs, '--', ctx.output] }]
  }
]
