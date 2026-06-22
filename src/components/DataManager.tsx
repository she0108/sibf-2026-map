import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePostHog } from '@posthog/react'
import {
  backupFilename,
  createBackupArchive,
  readBackupArchive,
  restoreBackup,
  type BackupImport,
  type BackupSummary,
} from '../lib/backup'
import { captureEvent } from '../lib/analytics'

interface Props {
  boothIds: string[]
  onImported: (visitOrder: string[]) => void
  mobile?: boolean
}

function summaryProperties(summary: BackupSummary) {
  return {
    saved_booth_count: summary.savedBoothCount,
    memo_count: summary.memoCount,
    photo_count: summary.photoCount,
  }
}

export default function DataManager({ boothIds, onImported, mobile = false }: Props) {
  const posthog = usePostHog()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [preview, setPreview] = useState<BackupImport | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const validBoothIds = new Set(boothIds)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, open])

  const resetFeedback = () => {
    setPreview(null)
    setMessage('')
    setError('')
  }

  const close = () => {
    if (busy) return
    setOpen(false)
    resetFeedback()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const exportData = async () => {
    setBusy('export')
    resetFeedback()
    try {
      const { blob, summary } = await createBackupArchive(validBoothIds)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = backupFilename()
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('백업 파일을 내보냈습니다.')
      captureEvent(posthog, 'data_backup_exported', summaryProperties(summary))
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : '백업 파일을 만들지 못했습니다.'
      setError(reason)
      captureEvent(posthog, 'data_backup_failed', {
        action: 'export',
        reason: 'archive_creation',
      })
    } finally {
      setBusy(null)
    }
  }

  const selectImportFile = async (file: File) => {
    setBusy('import')
    resetFeedback()
    try {
      setPreview(await readBackupArchive(file, validBoothIds))
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : '백업 파일을 읽지 못했습니다.'
      setError(reason)
      captureEvent(posthog, 'data_backup_failed', { action: 'import', reason: 'archive_read' })
    } finally {
      setBusy(null)
    }
  }

  const importData = async () => {
    if (!preview) return
    setBusy('import')
    setError('')
    try {
      const visitOrder = await restoreBackup(preview)
      onImported(visitOrder)
      setMessage('백업 데이터를 가져왔습니다.')
      captureEvent(posthog, 'data_backup_imported', summaryProperties(preview.summary))
      setPreview(null)
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : '데이터를 복원하지 못했습니다.'
      setError(reason)
      captureEvent(posthog, 'data_backup_failed', { action: 'import', reason: 'restore' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={'data-manager' + (mobile ? ' data-manager--mobile' : '')}>
      <button
        ref={triggerRef}
        type="button"
        className="data-manager__trigger"
        aria-label="데이터 백업 및 복원"
        title="데이터 백업 및 복원"
        aria-expanded={open}
        onClick={() => {
          resetFeedback()
          setOpen(true)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="10" cy="5" rx="6.5" ry="2.5" />
          <path d="M3.5 5V15C3.5 16.4 6.4 17.5 10 17.5C11.1 17.5 12.2 17.4 13.1 17.1" />
          <path d="M3.5 10C3.5 11.4 6.4 12.5 10 12.5C11.1 12.5 12.2 12.4 13.1 12.1" />
          <path d="M15.5 13.5A4.5 4.5 0 1 1 14.6 19.2" />
          <path d="M14.5 10.5L15.5 13.5L18.5 12.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div className="data-manager__layer">
            <button
              type="button"
              className="data-manager__backdrop"
              aria-label="데이터 관리 닫기"
              onClick={close}
            />
            <section
              className="data-manager__dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="data-manager-title"
            >
              <header className="data-manager__header">
                <div>
                  <h2 id="data-manager-title">데이터 백업 및 복원</h2>
                  <p>관심 부스, 방문 순서, 메모, 사진을 모두 백업합니다.</p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  className="data-manager__close"
                  aria-label="닫기"
                  onClick={close}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7L17 17" />
                    <path d="M17 7L7 17" />
                  </svg>
                </button>
              </header>

              <div className="data-manager__body">
                {!preview && (
                  <div className="data-manager__actions">
                    <button type="button" onClick={exportData} disabled={Boolean(busy)}>
                      <strong>{busy === 'export' ? '내보내는 중…' : '백업 파일 내보내기'}</strong>
                      <span>현재 데이터를 ZIP 파일로 저장합니다.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={Boolean(busy)}
                    >
                      <strong>{busy === 'import' ? '파일 확인 중…' : '백업 파일 가져오기'}</strong>
                      <span>이전에 저장한 ZIP 파일을 불러옵니다.</span>
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void selectImportFile(file)
                      }}
                    />
                  </div>
                )}

                {preview && (
                  <div className="data-manager__confirm">
                    <h3>이 백업으로 교체할까요?</h3>
                    <dl>
                      <div><dt>관심 부스</dt><dd>{preview.summary.savedBoothCount}개</dd></div>
                      <div><dt>메모</dt><dd>{preview.summary.memoCount}개</dd></div>
                      <div><dt>사진</dt><dd>{preview.summary.photoCount}개</dd></div>
                    </dl>
                    <p>현재 기기에 저장된 데이터는 모두 교체됩니다.</p>
                    <div className="data-manager__confirm-actions">
                      <button type="button" onClick={() => setPreview(null)} disabled={Boolean(busy)}>
                        취소
                      </button>
                      <button type="button" onClick={importData} disabled={Boolean(busy)}>
                        {busy === 'import' ? '가져오는 중…' : '교체하고 가져오기'}
                      </button>
                    </div>
                  </div>
                )}

                {message && <div className="data-manager__message">{message}</div>}
                {error && <div className="data-manager__error">{error}</div>}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  )
}
