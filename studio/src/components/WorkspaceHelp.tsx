import { FolderOpen } from "lucide-react";
import { Modal } from "@/components/Modal";

const folders = [
  ["scenes/", "Código e composição ao vivo."],
  ["assets/", "Imagens, áudios, fontes e recursos."],
  ["renders/", "Vídeos, stills e versões exportadas."],
  ["projects/", "Contexto, motion.json, referências e anotações."],
];

export function WorkspaceHelp({
  root,
  onClose,
}: {
  root: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Seu workspace de motion design" onClose={onClose}>
      <div className="modal-body help-body">
        <p>
          O Motion Studio organiza e visualiza os arquivos desta pasta. Cada
          projeto usa o mesmo identificador em quatro lugares:
        </p>
        <dl>
          {folders.map(([folder, description]) => (
            <div key={folder}>
              <dt>{folder}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <p>
          Arquivos criados ou alterados nessas pastas aparecem sozinhos: a
          interface relê o disco a cada cinco segundos com a janela ativa.
        </p>
        <p>
          Para pedir uma alteração a um agent, indique o projeto e o arquivo{" "}
          <code>projects/&lt;projeto&gt;/motion.json</code>.
        </p>
        <div className="callout">
          <FolderOpen size={18} />
          <code>{root}</code>
        </div>
        <p className="helper">
          Para iniciar: <code>bun run build</code> e <code>bun run start</code>.
          Para desenvolver: <code>bun run dev</code>.
        </p>
      </div>
      <div className="modal-footer">
        <button className="button primary" onClick={onClose}>
          Entendi
        </button>
      </div>
    </Modal>
  );
}
