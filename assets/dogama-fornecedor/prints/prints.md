# Prints Dogama fornecedor

Capturas em 1440x900, tema claro. App: stack dogama-demo-front (http://127.0.0.1:5010, banco local dogama_demo_front). Landing: dogama-demo-landing, Astro dev em localhost:5199 (subido só para a captura e derrubado depois).

Observações gerais:
- O fornecedor com produtos SEED e armazém vinculado é `johndoe@example.com` (admin + fornecedor + plano ERP). `supplier@example.com` existe, mas não tem produtos nem armazém (o seed vincula produtos e warehouse ao primeiro usuário da lista). Por isso a sidebar dos prints 01 a 13 tem o grupo Admin (fora da área capturada na maioria) e o avatar mostra "AD" (Admin Doe).
- O app só autentica abrindo em `127.0.0.1:5010`. Em `localhost:5010` o login cai em CORS e mostra o toast "Sistema em manutenção".
- A foto do SEED-CALCA-002 é o tênis `1dd4c175...webp` (subido por mim para liberar a publicação). O nome continua "Calca Jeans Azul".

## App, como fornecedor (johndoe@example.com)

| Arquivo | O que mostra | Cópia literal relevante |
|---|---|---|
| 01-erp-produtos.png | /app/erp/produtos em grade, SEED-CALCA-002 sem foto e sem preço de drop; botão de publicar (seta) desabilitado. SEED-CAMISETA-001 já no catálogo (X vermelho = despublicar). | "ERP › Produtos", "Buscar por nome, SKU ou marca", "Filtros", "Tour", "Adicionar", "Selecionar página", "Produtos (1)", "Fornecedores (2461)", "Categoria não definida", "Calca Jeans Azul", "R$ 99,90", "Simples", "Estoque: 50", "SKU: SEED-CALCA-002", "Original", "0 venda", "0 venda de Drop", "Imagens não atribuídas", "Ver detalhes das validações (2)", "Editar", "Anunciar"; card 2: "Camiseta Basica Preta", "R$ 49,90", "Estoque: 100", "SKU: SEED-CAMISETA-001" |
| 02-editar-produto-preco-drop.png | Edição do produto com a foto enviada e o campo "Preço de custo (drop)" preenchido com 49,90 (o preço de drop não fica no diálogo de publicar, e sim aqui). Coluna direita com status por marketplace. | "ERP › Produtos › Editar › Calca Jeans Azul", "Excluir", "Duplicar", "Preço de venda *" "R$ 99,90" "Preço sugerido de venda ao consumidor final", "Preço de custo (drop)" "R$ 49,90" "Preço cobrado pelo fornecedor no dropshipping", "Preço de custo (fabricação)" "Custo de fabricação do produto", "Mercado Livre / Shopee / TikTok Shop / Shein" "Pendente" "Selecionar categoria" "Gerar" "Ficha Técnica 0%", barra flutuante "Alterações não salvas" "Salvar" |
| 03-dialogo-alterar-preco-drop.png | Diálogo de confirmação ao salvar o preço de drop. | "Alterar Preço de Drop", "Esta ação irá notificar todos os usuários que possuem anúncios deste produto", "Alterar o preço de drop pode afetar as vendas e a percepção do cliente", "Novo Preço de Drop", "R$ 49,90", "Cancelar", "Salvar alterações" |
| 04-erp-produtos-pronto-para-publicar.png | Lista depois de salvar: foto no card, "Anunciar" ativo e o botão de publicar (seta azul) habilitado. | "Preço de custo não…", "Ver detalhes das validações (1)", "Anunciar" |
| 05-dialogo-publicar-produto.png | Ação "Publicar produto" aberta (abre o diálogo porque há validação de baixa severidade pendente). Foi confirmada. | "Publicar produto", "Antes de publicar o produto, verifique as validações dele, quanto mais completo for o seu produto, melhor será sua performance no catálogo.", "Preço de custo não preenchido", pílula "Observação", "O campo de preço de custo está em branco, o que pode impactar relatórios e análises financeiras", "Resolver agora", "Ver no FAQ", "Cancelar", "Publicar" |
| 06-toast-adicionado-ao-catalogo.png | Toast logo após publicar; o botão do card virou X vermelho (despublicar). | "Adicionado ao catálogo!", "Acesse o catálogo para ver", "Abrir catálogo" |
| 06b-toast-close.png | Recorte do toast (360x90). | idem |
| 07-erp-estoque.png | /app/erp/estoque com os dois produtos SEED. | "ERP › Estoque", "Pesquisar por Título ou SKU", "Adicionar Produto", "Filtros", "Calca Jeans Azul" "SEED-CALCA-002" "Produto simples" "17/09/2026" "Estoque" "50 unidades"; "Camiseta Basica Preta" "SEED-CAMISETA-001" "100 unidades"; "Últimas movimentações" "Nenhuma movimentação recente"; "Tem produtos em outros ERPs?" "Você pode importar seus produtos de outros ERPs automaticamente" "Importar"; "Duvidas sobre estoque?" "Visite nossa central de ajuda para descobrir mais" "Central de ajuda" |
| 08-vendas-vazio.png | /app/vendas antes de existir venda (captura da sessão anterior). | "Marketplaces › Vendas", "Buscar vendas", "Filtros", "Mais ações", "Alternar seleção", "Modo Drop", "Não há vendas para exibir", "Quando você vender algum produto anunciado pela Dogama, vamos te mostrar aqui os detalhes da venda" |
| 08b-vendas-modo-drop-vazio.png | Idem com o toggle "Modo Drop" ligado (URL `?drop_mode=true`). | idem |
| 09-vendas-fornecedor-venda-drop.png | /app/vendas do fornecedor com a venda drop gerada pelo revendedor (fluxo real do app, ver 15b a 15d). Pílula "Drop", status "Pendente" (pagamento ainda não feito pelo revendedor, sem saldo na carteira). | "MANUAL-4581184BD32CB772AD372AEF", pílula "Drop", "Calca Jeans Azul", "SKU: SEED-CALCA-002", "Quantidade: 1 item", "Vendedor/plataforma" "Dogama", "Comprador" "Desconhecido", "Data" "29/09/2026 - 18:22", "Valor total:" "R$ 49,90", "Status do pedido" pílula "Pendente", timeline "Pagamento pendente", "Separação pendente", "Envio pendente", "Aguardando conclusão" |
| 10-erp-envios.png | /app/erp/envios (Controle de Envios) antes do scan. | "ERP › Controle de Envios", "Escanear Código", "Câmera", pílula "Pronto para escanear", "Plataforma de envio", "Selecionar plataforma...", "Aguardando bipagem ou digite manualmente...", "Envios hoje 0", "Envios ontem 0", "Envios nessa semana 0", "Envios", "Buscar código...", "Todos os canais", "Nenhum scan encontrado", "Escaneie códigos de rastreio para ver aqui" |
| 11b-erp-envios-scan-plataforma-obrigatoria.png | Código da venda digitado sem plataforma: campo em vermelho e toast. | "Plataforma de envio (obrigatório)", "MANUAL-4581184BD32CB772AD372AEF", "Limpar", "Enter", toast "Selecione uma plataforma" "Escolha a plataforma de envio para continuar" |
| 11-erp-envios-scan-registrado.png | Scan concluído com plataforma Dogama. Não apareceu "Venda detectada!": o match de venda só acontece por código de rastreio de um shipment (DbMetaShipments.resolveScanTarget), e a venda manual não tem etiqueta. | "Dogama", "Envios hoje 1", "Envios nessa semana 1", colunas "DATA" "RASTREIO" "VENDA" "PLATAFORMA", linha "29/09/2026 18:24" "MANUAL-4581184BD32CB772AD372AEF" "-" "Dogama", toast "Envio registrado" "Plataforma: dogama" |
| 12-perfil-carteira.png | /app/perfil?path=wallet | "Admin Doe", "johndoe@example.com", "Usuário desde 2026", "ROTAS": "Visão Geral", "Dados Pessoais", "Segurança", "Carteira", "Usuários", "Configurações"; "Carteira" "Saldo, saques e chave PIX de recebimento", "Saldo na carteira" "Gerencie suas finanças de maneira simples e eficiente", "Seu saldo" "R$ 0,00", "Ver financeiro", "Adicionar saldo", "Sacar valor", "Gerenciar Chave pix", "Sem chave PIX cadastrada" "Para efetuar saques é necessário cadastrar uma chave PIX", "Tipo de chave PIX", "Chave PIX" |
| 13-perfil-financeiro.png | Tela financeira. URL real: **/app/perfil/financeiro** (arquivo de rota `perfil.financeiro`, aberta pelo link "Ver financeiro"). | "29 ago, 2026 - 29 set, 2026", "Personalizado", "Movimentações detalhadas" "Veja em detalhes como foi o seu fluxo de movimentações", "Movimentações totais" "Tenha uma visão geral do seu fluxo de movimentações", "Nenhum dado encontrado", "Valores a liberar" "Veja cada movimentação prevista e quando o valor ficará disponível", "Total pendente" "R$ 0,00", "Não há valores aguardando liberação", "Histórico de transações" "Veja todos seus lançamentos financeiros" |

## App, como revendedor (user@example.com)

O usuário estava sem onboarding; passei pela triagem (/app/triagem, 8 passos: origem Google, "Já sei vender", faturamento "Prefiro não informar", "Pular conexão por enquanto").

| Arquivo | O que mostra | Cópia literal relevante |
|---|---|---|
| 14-drop-loja-produto-publicado.png | /app/drop/loja buscando "Calca Jeans Azul": o produto do fornecedor publicado no catálogo, com o preço de drop. | "Dropshipping › Catálogo", "Buscar produtos", "Categorias", "Filtros", "Tour", "Carrinho", "Calca Jeans Azul", "R$ 49,90", "Original", "Anúncios" "Ainda não anunciado", "Anunciar" |
| 14b-drop-loja-geral.png | Catálogo geral (dados do clone de produção), com o popup "Conecte sua conta de vendedor". | "Em destaque", "CORRENTE AÇO CARTIER PRATA" "Joias e Relógios" "R$ 14,90", "Tênis Casual Lona Classic Ab Star" "R$ 44,90", "Conecte sua conta de vendedor", "Para vender com a Dogama, conecte um canal de vendas: marketplace ou e-commerce.", "Conectar agora" |
| 15-drop-loja-detalhe-produto.png | Detalhe do produto (/app/drop/loja/d24ad8a7-a342-4c59-9cb3-af317929a066). | "Dropshipping › Catálogo › Calca Jeans Azul", pílulas "Simples" "Disponível", "SEU CUSTO" "R$ 49,90" "Verifique seu plano para saber mais sobre taxas", "Comprar", "Anunciar", "Origem do envio" "Sao Paulo" "Lembre-se de adicionar o endereço de remetente do produto a sua conta." "Copiar endereço" "Saiba mais", "Produto Original" "Produtos originais podem ser anunciados sem problemas em todos os marketplaces.", "Descrição" "Informações fornecidas pelo responsável pelo produto", "Especificações" "Dados gerais e logísticos do produto" |
| 15b-revendedor-carrinho-venda-drop.png | "Comprar" leva a /app/vendas/adicionar (passo 1). | "Informações dos produtos" "Passo 1", "Voltar para loja", "Meu Carrinho" "1 produto", "Limpar", "Adicionar", "Quantidade", "Valor de venda", "Calcular entrega", "Quando a venda utiliza uma etiqueta de envio externa, o cálculo de frete não é necessário", "Não lembro meu CEP", "Resumo do pedido", "Produtos (1) R$ 49,90", "Frete R$ 0,00", "Total R$ 49,90", "Continuar", "Verifique atentamente todos os produtos antes de continuar" |
| 15c-revendedor-resumo-venda-drop.png | Passo 4 com etiqueta externa (sem frete). Venda finalizada em seguida. | "Resumo da venda" "Passo 4", "Produtos da venda", "Disponível em estoque", "1 unidade", "Valor de custo" "R$ 49,90", "Método de envio", "Trocar método", "Etiqueta gerenciada por você", "Etiqueta pendente", "Subtotal dos produtos", "Frete externo gerenciado por você", "Valor total R$ 49,90", "Finalizar venda", "Voltar e editar" |
| 15d-revendedor-vendas-drop-pendente.png | /app/vendas do revendedor com a venda drop criada. | "Você tem 1 venda pendente", "Use o saldo da carteira para pagar da mais antiga para a mais recente.", "Pagar vendas pendentes", pílula "Drop", "Custo:" "R$ 52,89", "Valor total:" "R$ 99,90", "Pendente" |

Ao finalizar a venda, o dev overlay do Bun mostrou um "Runtime Error: Invalid hook call" vindo de `NotificationIcon` (handleNewNotification); o toast "Venda adicionada!" saiu normalmente. Bug do app, fora do escopo.

## Landing (dogama-demo-landing)

| Arquivo | O que mostra | Cópia literal relevante |
|---|---|---|
| 16-lp-seja-fornecedor.png | /seja-fornecedor, dobra inicial. | "PARA FABRICANTES, IMPORTADORES E DISTRIBUIDORES", "Seu estoque vendendo em todo o Brasil", "Uma rede de revendedores anuncia seus produtos em marketplaces e lojas virtuais. Você cadastra, recebe o pedido e envia ao consumidor final.", "A Dogama conecta fabricantes, importadores e distribuidores a vendedores que procuram produtos competitivos para revender.", "Quero cadastrar minha empresa", "Cadastro sujeito à análise comercial e operacional.", "35k+ revendedores cadastrados", "Vendas em todos os canais, para todo o Brasil", "COMO FUNCIONA": "1 Sua empresa cadastra produtos, preços e estoque", "2 Revendedores escolhem e anunciam nos marketplaces", "3 Venda realizada: o pedido entra no seu painel", "4 Você envia o pedido e acompanha o repasse", "ONDE OS REVENDEDORES ANUNCIAM SEUS PRODUTOS" |
| 16b-lp-seja-fornecedor-full.png | Página inteira (1425x7617). | Toda a cópia está em `apps/front/src/constants/lp/supplier.ts:3-300` (pt). |
| 17-lp-home-hero.png | Home, hero com o topo do HeroPaths. | "+35 mil vendedores já vendem com a Dogama", "Venda nos maiores marketplaces do Brasil, com estoque ou sem", "Comece sem estoque: fornecedores brasileiros enviam direto ao seu cliente.", "Conhecer o Dropshipping", "Conhecer o ERP", "Testar grátis", "Sem cartão de crédito · Pode começar com CPF" |
| 18-lp-heropaths-drop-pago.png | HeroPaths com a aba "Venda sem estoque" ativa (timer congelado via `--lp-tab`), DropLane no estado "Pago" + "Seu lucro". | Abas "Venda sem estoque", "ERP rápido e preciso"; DropLane: "Produto de fornecedor", "Venda feita" "R$ 99,90", "Custo do fornecedor" "R$ 49,90", "Pagar fornecedor" / "Pago", "Fornecedor envia ao cliente", "Seu lucro · R$ 50,00"; SalesHub: "Minhas vendas"; ErpLane: "Produto do seu estoque", "NF emitida", "Etiqueta gerada", "Estoque" 12/11, "Sincronizado"; card: "QUERO COMEÇAR A VENDER", "Venda sem estoque", "Venda primeiro, compre do fornecedor depois. Você anuncia produtos de fornecedores brasileiros, paga só o custo quando vende e o fornecedor envia direto ao cliente.", "Conhecer o Dropshipping", "Sem cartão de crédito · Pode começar com CPF" |
| 18b-lp-heropaths-drop-pago-close.png | Recorte 1120x620 só do componente (abas + frame). | idem |
| 18c-lp-heropaths-drop-pagar-fornecedor-close.png | Mesmo recorte, estado anterior do loop ("Pagar fornecedor", sem pílula de lucro). | idem |
| 18d-lp-heropaths-erp-close.png | Recorte com a aba ERP ativa (ramo drop esmaecido em cinza). | "JÁ VENDO E QUERO CRESCER", "ERP rápido e preciso", "Você vende o seu próprio estoque. Pedidos, NF, etiqueta e estoque sincronizados em todos os canais, sem retrabalho.", "Conhecer o ERP", "Migração, integração e treinamento por nossa conta" |
| 18e-lp-heropaths-droplane-saleshub-zoom.png | Zoom em DropLane ← SalesHub com a linha tracejada e os pontos. | idem |
| 19-lp-quiz-pergunta.png | Quiz (#qual-caminho) antes de responder. | "AINDA EM DÚVIDA?", "Descubra seu caminho em 10 segundos", "Uma pergunta. A gente mostra por onde começar.", "Qual frase descreve melhor o seu momento?", "Quero começar a vender, sem investir em estoque", "Já vendo e quero organizar e escalar a operação", "Tenho indústria ou distribuidora e quero revendedores" |
| 19b-lp-quiz-resultado-fornecedor.png | Resultado do caminho fornecedor. | "SEU CAMINHO: FORNECEDOR", "Seus produtos na vitrine de milhares de revendedores", "Nossa rede anuncia seus produtos nos maiores marketplaces do Brasil. Você só cuida do envio.", "Quero ser fornecedor", "Responder de novo" |
| 20-lp-supplier-banner.png | SupplierBanner na home (entre Media e FinalCta). | "PARA INDÚSTRIAS E DISTRIBUIDORES", "Uma rede de revendedores em todo o Brasil", "Coloque seu catálogo na Dogama e milhares de revendedores anunciam seus produtos no Mercado Livre, Shopee, TikTok Shop e outros canais.", "Seja um fornecedor" |
| 20b-lp-supplier-banner-close.png | Recorte do banner. | idem |

Cópia pt da home: `apps/front/src/locales/pt/lp-home.json` (chaves `hero`, `quiz`, `supplierBanner`).

## HeroPaths: medidas e animação (dogama-demo-landing/apps/front/src)

Estrutura (`components/astro/landing/home/sections/HeroPaths.astro`):
- Grid `lg:grid-cols-[1fr_auto_1fr]`, padding `lg:px-8 lg:py-10` (32px / 40px), gap 0 no desktop (:53). Ordem: DropLane (1), SalesHub (2, largura fixa `lg:w-[320px]`, :71), ErpLane (3).
- Frame: `rounded-b-lg border border-border bg-muted shadow-xl shadow-black/10` (:50), fundo pontilhado `radial-gradient(circle, border 90%, transparent 1px)` em grade de 14px (:114-121).
- Abas (`HeroPathTabs.astro:17-37`): `rounded-t-lg`, 2 colunas com divisor, `px-6 py-5` (24/20px), título `text-title-2 font-semibold`, seta em círculo `size-8` (32px) com borda. Aba ativa: seta preenchida com primary e texto branco. Timer: barra `h-1` (4px) no topo da aba, cor primary, `scaleX 0→1` linear em `--lp-tab` (9s), no `animationend` o script troca de aba (:63-83, :95).
- Ramo fora de foco: `opacity: 0.25; filter: grayscale(1)` com transição 0.5s ease-out e o ponto viajante fica `visibility: hidden` (:123-140).
- Card de explicação (HeroPathCard) sobreposto ao frame com `lg:-mt-40` (:90), entra com `opacity 0→1` e `translate 0 6px→0`, transição 300ms (:149-160).

Linhas tracejadas (não são SVG, não há `stroke-dasharray` no HeroPaths; são bordas CSS):
- Conectores horizontais DropLane↔SalesHub e SalesHub↔ErpLane: `span h-px w-10 border-t border-dashed border-primary-400` (40px de largura, borda 1px tracejada, padrão de traço do navegador) em `HeroPaths.astro:60-61` e `:78-79`.
- Conector vertical logos → "Minhas vendas": `h-7 w-px border-l border-dashed border-primary-400` (28px de altura) em `components/astro/shared/scenes/SalesHub.astro:59`.
- Cor da linha: `--primary-400` = oklch(74% 0.115 239.5) ≈ #60B4EC (`styles/tokens.css:7`).
- Existe um `lpDash` (`stroke-dashoffset` até -16 em 1.2s linear) em `styles/scenes.css:6-8,71-75`, mas nenhum desses três conectores o usa.

Ponto que percorre as linhas (`.lp-travel`):
- `size-2` (8px), `rounded-full bg-primary`, anel `shadow-[0_0_0_3px] shadow-primary/20` (halo de 3px com primary a 20%) (`HeroPaths.astro:64,82`; `SalesHub.astro:61`).
- Primary = oklch(50% 0.11 241) ≈ #126A9C (`styles/tokens.css:24`).
- Animação `lpTravel 2.4s ease-in-out infinite` (`styles/scenes.css:48-51`), keyframes em `:187-202`: 0% opacity 0 no ponto de partida, 15% opacity 1, 85% opacity 1, 100% opacity 0 em `translate(--tx, --ty)`.
- Direções: esquerdo parte da direita e anda `--tx:-40px` (do hub para o DropLane, `HeroPaths.astro:65`); direito parte da esquerda e anda `--tx:40px` (do hub para o ErpLane, `:83`); vertical anda `--ty:28px` para baixo, dos logos para a lista (`SalesHub.astro:62`). Velocidade: 40px em 2.4s ≈ 16,7 px/s (28px em 2.4s ≈ 11,7 px/s), com ease-in-out.
- Fluxo lido: canais → SalesHub → cada ramo (a seta da frase "DropLane ← SalesHub → ErpLane").

SalesHub (`components/astro/shared/scenes/SalesHub.astro`):
- Linha de logos: 5 tiles `size-9` (36px) `rounded-md border bg-card shadow-sm`, gap 12px, logos 20px (mercado-livre, shopee, amazon, shein, magalu) (:13, :49-56).
- SceneWindow (`SceneWindow.astro:13-31`): `rounded-lg border bg-card shadow-xl shadow-black/10`, barra `bg-muted px-4 py-2.5` com 3 bolinhas `size-2.5` (10px) cor border e título "Minhas vendas" `text-caption font-medium text-muted-foreground`.
- Lista: área 140px de altura; cada venda `h-14` (56px) `px-3 py-2 gap-2.5 border-b`, logo do canal 20px, foto 40px `rounded-md`, duas barras skeleton (112x10 a 15% e 64x8 a 10% do foreground), preço `text-body-sm font-bold`, check 20px `bg-teal-600` (:66-98). Vendas: ML R$ 99,90, Shopee R$ 64,90, Amazon R$ 89,90, Shein R$ 49,90, Magalu R$ 69,90, ML R$ 44,90 (:14-45).
- Animação `lpSale 18s cubic-bezier(0.22, 1, 0.36, 1)`, atraso `index*3 - 18`s; entra de -56px, desce em degraus de 56px (0, 56, 112, 168) e some (:108-140). Fade inferior de 40px até card 98% (:142-148).

DropLane (`components/astro/shared/scenes/DropLane.astro`), loop `--lp-loop: 7s` (:35):
- Card `rounded-lg border bg-card p-4 gap-3 shadow-lg shadow-black/5` (:32). Foto 36px `rounded-md` (0402835e...webp) + "Produto de fornecedor" `text-body-sm font-semibold`.
- "Venda feita" `R$ 99,90`: linha `rounded-md border bg-muted/50 px-3 py-2`, check 20px teal-600 com `lpSeq` delay 0.3s (:48-61).
- "Custo do fornecedor" `R$ 49,90` em `text-body font-bold text-yellow-700` (≈ #A65F00) (:66-75). Botão 28px de altura `rounded-md`, alterna `lpFlipA` "Pagar fornecedor" (bg primary) → `lpFlipB` "Pago" (bg teal-600 ≈ #009689, com check), `text-[11px] font-semibold` (:76-87); troca entre 40% e 50% do loop (≈ 2,8s a 3,5s).
- "Fornecedor envia ao cliente": ícone caminhão em círculo 24px bg primary, `lpSeq` delay 3.6s (:90-100).
- Pílula "Seu lucro · R$ 50,00": `rounded-full bg-teal-600 px-3 py-1 text-caption font-semibold text-white`, `lpPop` delay 1.4s (:102-107).

ErpLane (`components/astro/shared/scenes/ErpLane.astro`), loop 7s:
- Mesmo card. "NF emitida" e "Etiqueta gerada" com checks `lpSeq` delays 1.2s e 1.9s (:42-56). "Estoque" 12 → 11 (flip, novo valor em primary) (:62-70). Tiles de canal 32px sobrepostos a cada 26px, check 16px teal com anel 2px card, delays 3.4s + 0.35s por tile (:72-83, `LogoTile.astro`).

Keyframes auxiliares (`styles/scenes.css`): `lpSeq` (:77-93) aparece em 8% a 16% (scale 0.85→1) e some em 84% a 94%; `lpPop` (:95-111) sobe 6px e aparece em 40% a 48%, some em 86% a 94%; `lpFlipA/B` (:204-228) trocam em 40% a 50% com deslocamento de 8px.

Tokens e medidas úteis:
- Cores claras (computadas no navegador): primary #126A9C, primary-400 #60B4EC, teal-600 #009689, teal-700 #00786F, yellow-700 #A65F00, border #E4E8EE, muted #F2F6FA, card #FFFFFF, foreground #091124, muted-foreground #6D7D92, medium-foreground #3B485E.
- Raios (Tailwind v4 padrão): `rounded-md` 6px, `rounded-lg` 8px, `rounded-full`.
- Tipos (`styles/globals.css`): body 16px, body-sm 14px / 1.45, caption 12px / 1.4; fonte Inter Variable.

## Assets copiados (../)

- `product/1dd4c175-1cb4-5a37-bcd6-dff1b4c2dc8a.webp` (tênis preto/laranja/azul, usado como foto do SEED-CALCA-002) e `product/0402835e-0cbf-5895-830c-90c06c5dbd00.webp` (foto do DropLane e 1ª venda do SalesHub).
- `logos/`: todos os SVGs de `public/svg/services_logos/`. Pedidos: Mercado Livre `mercado-livre.svg`, `mercado-livre_name.svg`; Shopee `shopee.svg`, `shopee_name.svg`; TikTok Shop: não há arquivo específico, só `tiktok.svg`, `tiktok_name.svg`; Shein `shein.svg`, `shein_name.svg`; Shopify `shopify.svg`, `shopify_name.svg`; Nuvemshop `nuvemshop.svg`, `nuvemshop_name.svg`. Também usados no HeroPaths: `amazon.svg`, `magalu.svg`.
- `logo/`: `symbol_color.svg`, `symbol_black.svg`, `symbol_white.svg`, `name_color.svg`, `name_only_color.svg`, `name_black.svg`, `name_white.svg`.
- Brand blue real do logo: **#1B7FB6** (em `symbol_color.svg`, `name_color.svg`, `name_only_color.svg`; versões black usam #202020). Note que o primary da UI é outro tom (#126A9C).
