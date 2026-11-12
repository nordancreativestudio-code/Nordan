export function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card">
      <div className="empty">
        <b>{titulo}</b>
        {texto}
      </div>
    </div>
  );
}
