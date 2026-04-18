export default function Toast({ toasts }: { toasts: {id:number;msg:string;type:string}[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && '✅ '}
          {t.type === 'error' && '❌ '}
          {t.type === 'info' && 'ℹ️ '}
          {t.msg}
        </div>
      ))}
    </div>
  )
}
