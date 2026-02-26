import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <p className="text-sm text-sw-fg-2 mb-4">{message}</p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('cancel')}
        </button>
        <button type="button" onClick={onConfirm} disabled={isPending} className="btn-danger">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
