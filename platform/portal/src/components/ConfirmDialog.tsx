import * as Dialog from '@radix-ui/react-dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const confirmStyles =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-indigo-600 text-white hover:bg-indigo-700'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl dark:shadow-slate-900/20 p-6 w-full max-w-md animate-scale-in">
          <Dialog.Title className="text-lg font-semibold dark:text-slate-100">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 dark:text-slate-400 mt-2">
            {description}
          </Dialog.Description>

          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close asChild>
              <button
                data-testid="ohpp.confirm.cancel"
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              data-testid="ohpp.confirm.confirm"
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ${confirmStyles}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
