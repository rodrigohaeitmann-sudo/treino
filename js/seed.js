// Dados iniciais: biblioteca de exercícios e os Treinos A e B do artefato original.
// updatedAt = 0 → qualquer edição (neste ou em outro aparelho) prevalece na sincronização.

export const GROUPS = [
  { id: 'Pernas', color: 'var(--legs)' },
  { id: 'Panturrilha', color: 'var(--legs)' },
  { id: 'Peito', color: 'var(--push)' },
  { id: 'Ombros', color: 'var(--push)' },
  { id: 'Tríceps', color: 'var(--push)' },
  { id: 'Costas', color: 'var(--pull)' },
  { id: 'Bíceps', color: 'var(--pull)' },
  { id: 'Core', color: 'var(--core)' },
  { id: 'Potência', color: 'var(--power)' },
  { id: 'Outro', color: 'var(--power)' },
];
export const groupColor = g => (GROUPS.find(x => x.id === g) || GROUPS[GROUPS.length - 1]).color;

export const EQUIPMENT = ['Barra', 'Halter', 'Cabo', 'Máquina', 'Peso corporal', 'Kettlebell', 'Elástico', 'Outro'];

const ex = (id, name, group, equipment, o = {}) => ({
  id, name, group, equipment,
  type: 'weight', perSide: false, barbell: false, increment: 2.5,
  muscles: '', setup: '', steps: [], mistakes: '', alternatives: '', videos: [], anim: null,
  ...o, updatedAt: 0, deleted: false,
});

export const SEED_EXERCISES = [
  // ---- Treino A / B do artefato ----
  ex('boxjump', 'Box jump', 'Potência', 'Outro', {
    type: 'reps', increment: 0, anim: 'boxjump', muscles: 'Potência de membros inferiores',
    steps: ['Pés na largura do quadril, a um passo da caixa.', 'Desça rápido até ¼ de agachamento jogando os braços para trás.', 'Salte estendendo quadril, joelhos e tornozelos e aterrisse suave em cima da caixa, joelhos semiflexionados.', 'Desça da caixa caminhando, nunca saltando para trás.'],
    mistakes: 'Transformar em exercício de cansaço. Se a altura cair, encerre a série.', alternatives: 'Salto vertical no lugar (CMJ)' }),
  ex('agachamento', 'Agachamento livre', 'Pernas', 'Barra', {
    barbell: true, increment: 5, anim: 'agachamento', muscles: 'Quadríceps, glúteos, core',
    steps: ['Barra apoiada no trapézio, pés na largura dos ombros e pontas levemente para fora.', 'Inspire, trave o abdômen e desça levando o quadril para trás e para baixo.', 'Desça até a coxa ficar paralela ao chão, joelhos acompanhando a linha dos pés.', 'Suba empurrando o chão com o pé inteiro, mantendo o peito aberto.'],
    mistakes: 'Joelhos entrando para dentro ou lombar arredondando no fundo.', alternatives: 'Agachamento no Smith ou leg press' }),
  ex('supino', 'Supino reto', 'Peito', 'Barra', {
    barbell: true, increment: 2.5, anim: 'supino', muscles: 'Peitoral, tríceps, deltoide anterior',
    steps: ['Deite com olhos sob a barra, escápulas retraídas e pés firmes no chão.', 'Pegada um pouco além da largura dos ombros; tire a barra com braços estendidos.', 'Desça controlado até tocar a parte baixa do peito, cotovelos a ~45° do tronco.', 'Empurre a barra para cima e levemente para trás, sobre os ombros.'],
    mistakes: 'Cotovelos abertos a 90° e glúteo saindo do banco.', alternatives: 'Supino com halteres ou máquina' }),
  ex('remada_halter', 'Remada apoiada (halter)', 'Costas', 'Halter', {
    perSide: true, increment: 2, anim: 'remada_halter', muscles: 'Dorsais, romboides, bíceps',
    steps: ['Apoie mão e joelho do mesmo lado no banco, costas paralelas ao chão.', 'Braço livre estendido segurando o halter.', 'Puxe o halter em direção ao quadril, cotovelo rente ao corpo.', 'Aperte a escápula no topo e desça devagar.'],
    mistakes: 'Girar o tronco para “roubar” a carga.', alternatives: 'Remada máquina ou remada curvada com barra' }),
  ex('desenvolvimento', 'Desenvolvimento (halteres)', 'Ombros', 'Halter', {
    perSide: true, increment: 2, anim: 'desenvolvimento', muscles: 'Deltoides, tríceps',
    steps: ['Sentado com encosto, halteres na altura das orelhas.', 'Abdômen firme e lombar apoiada.', 'Empurre os halteres para cima até quase encostar um no outro.', 'Desça controlado até a altura inicial.'],
    mistakes: 'Arquear muito a lombar para empurrar.', alternatives: 'Desenvolvimento na máquina' }),
  ex('puxada', 'Puxada frente', 'Costas', 'Cabo', {
    increment: 5, anim: 'puxada', muscles: 'Dorsais, bíceps',
    steps: ['Coxas presas sob o apoio, pegada pronada um pouco além dos ombros.', 'Incline o tronco levemente para trás.', 'Puxe a barra até a parte alta do peito levando os cotovelos para baixo.', 'Suba controlado até estender os braços.'],
    mistakes: 'Puxar atrás da nuca ou balançar o tronco.', alternatives: 'Barra fixa assistida' }),
  ex('pallof', 'Pallof press', 'Core', 'Cabo', {
    increment: 2.5, anim: 'pallof', muscles: 'Core anti-rotação',
    steps: ['Cabo na altura do peito, de lado para a polia.', 'Segure a pegada junto ao esterno, pés afastados.', 'Estenda os braços à frente sem deixar o tronco girar.', 'Segure 1 s e volte devagar. Faça os dois lados.'],
    mistakes: 'Deixar o quadril e os ombros girarem para a polia.', alternatives: 'Prancha lateral' }),
  ex('panturrilha', 'Panturrilha em pé', 'Panturrilha', 'Máquina', {
    increment: 5, anim: 'panturrilha', muscles: 'Gastrocnêmio, sóleo',
    steps: ['Ponta dos pés num degrau, calcanhares para fora.', 'Suba o máximo possível e segure 1 s no topo.', 'Desça devagar até alongar bem a panturrilha.'],
    mistakes: 'Quicar embaixo e encurtar a amplitude.', alternatives: 'Panturrilha na máquina ou no leg press' }),
  ex('broadjump', 'Salto horizontal', 'Potência', 'Peso corporal', {
    type: 'reps', increment: 0, anim: 'broadjump', muscles: 'Potência de membros inferiores',
    steps: ['Pés na largura do quadril.', 'Agache levemente jogando os braços para trás.', 'Salte o mais longe possível projetando braços e quadril à frente.', 'Aterrisse suave com joelhos flexionados e segure 2 s.'],
    mistakes: 'Aterrissar com joelhos para dentro ou pernas rígidas.', alternatives: 'Agachamento com salto' }),
  ex('terra_romeno', 'Terra romeno', 'Pernas', 'Barra', {
    barbell: true, increment: 5, anim: 'terra_romeno', muscles: 'Posteriores de coxa, glúteos, eretores',
    steps: ['Em pé com a barra na altura do quadril, joelhos levemente flexionados.', 'Leve o quadril para trás deslizando a barra rente às coxas.', 'Desça até sentir o alongamento do posterior, costas neutras.', 'Volte contraindo glúteos até ficar em pé.'],
    mistakes: 'Arredondar a lombar ou agachar em vez de dobrar o quadril.', alternatives: 'Stiff com halteres ou mesa flexora' }),
  ex('barra_fixa', 'Barra fixa', 'Costas', 'Peso corporal', {
    increment: 2.5, anim: 'barra_fixa', muscles: 'Dorsais, bíceps',
    steps: ['Pegada pronada na largura dos ombros, braços estendidos.', 'Leve as escápulas para baixo antes de puxar.', 'Puxe até o queixo passar a barra, cotovelos em direção ao quadril.', 'Desça controlado até estender os braços.'],
    mistakes: 'Balançar o corpo ou fazer meia amplitude.', alternatives: 'Barra no gravitron ou puxada frente' }),
  ex('supino_inclinado', 'Supino inclinado (halteres)', 'Peito', 'Halter', {
    perSide: true, increment: 2, anim: 'supino_inclinado', muscles: 'Peitoral superior, deltoide anterior',
    steps: ['Banco a 30–45°, halteres ao lado do peito.', 'Escápulas retraídas e pés firmes.', 'Empurre os halteres para cima, aproximando-os no topo.', 'Desça controlado até a altura do peito.'],
    mistakes: 'Inclinação alta demais, que vira desenvolvimento.', alternatives: 'Supino inclinado com barra ou máquina' }),
  ex('bulgaro', 'Búlgaro (halteres)', 'Pernas', 'Halter', {
    perSide: true, increment: 2, anim: 'bulgaro', muscles: 'Quadríceps, glúteos',
    steps: ['Peito do pé de trás apoiado no banco, pé da frente um passo à frente.', 'Halteres ao lado do corpo.', 'Desça verticalmente até o joelho de trás quase tocar o chão.', 'Suba empurrando pelo pé da frente. Faça as duas pernas.'],
    mistakes: 'Pé da frente muito perto do banco, o que sobrecarrega o joelho.', alternatives: 'Afundo com halteres ou leg press unilateral' }),
  ex('remada_baixa', 'Remada baixa (cabo)', 'Costas', 'Cabo', {
    increment: 5, anim: 'remada_baixa', muscles: 'Dorsais, romboides, trapézio médio',
    steps: ['Sentado, pés na plataforma e joelhos levemente flexionados.', 'Braços estendidos com o tronco um pouco à frente.', 'Puxe a pegada até o abdômen, voltando o tronco à vertical.', 'Aperte as escápulas e retorne devagar.'],
    mistakes: 'Balançar muito o tronco para mover a carga.', alternatives: 'Remada máquina ou remada com halter' }),
  ex('roda', 'Roda abdominal', 'Core', 'Outro', {
    type: 'reps', increment: 0, anim: 'roda', muscles: 'Reto abdominal, core anti-extensão',
    steps: ['Ajoelhado, mãos na roda sob os ombros.', 'Contraia abdômen e glúteos.', 'Role à frente até onde conseguir sem arquear a lombar.', 'Volte puxando com o abdômen.'],
    mistakes: 'Deixar a lombar afundar no fim do movimento.', alternatives: 'Prancha com alcance ou dead bug' }),
  ex('panturrilha_uni', 'Panturrilha unilateral', 'Panturrilha', 'Halter', {
    perSide: true, increment: 2, anim: 'panturrilha_uni', muscles: 'Gastrocnêmio, sóleo, estabilidade do tornozelo',
    steps: ['Uma perna no degrau, halter na mão do mesmo lado.', 'Apoie a outra mão para equilíbrio.', 'Suba o máximo e segure 1 s.', 'Desça devagar até alongar. Troque de perna.'],
    mistakes: 'Tornozelo “caindo” para fora durante a subida.', alternatives: 'Panturrilha sentado na máquina' }),

  // ---- Biblioteca extra para montar novos treinos ----
  ex('leg_press', 'Leg press 45°', 'Pernas', 'Máquina', {
    increment: 10, muscles: 'Quadríceps, glúteos',
    steps: ['Costas e quadril bem apoiados, pés na largura do quadril no meio da plataforma.', 'Destrave e desça até ~90° de joelho sem tirar o quadril do banco.', 'Empurre com o pé inteiro sem travar os joelhos no topo.'],
    mistakes: 'Descer tanto que a lombar sai do encosto.', alternatives: 'Hack machine ou agachamento' }),
  ex('extensora', 'Cadeira extensora', 'Pernas', 'Máquina', {
    increment: 5, muscles: 'Quadríceps',
    steps: ['Ajuste o encosto para o joelho alinhar com o eixo da máquina.', 'Estenda os joelhos até quase travar e segure 1 s.', 'Desça controlando.'],
    mistakes: 'Dar tranco para subir a carga.', alternatives: 'Agachamento búlgaro' }),
  ex('flexora', 'Mesa flexora', 'Pernas', 'Máquina', {
    increment: 5, muscles: 'Posteriores de coxa',
    steps: ['Joelho alinhado com o eixo, apoio logo acima do calcanhar.', 'Flexione levando o calcanhar em direção ao glúteo.', 'Volte devagar sem deixar a carga bater.'],
    mistakes: 'Tirar o quadril do banco para ajudar.', alternatives: 'Cadeira flexora ou stiff' }),
  ex('hip_thrust', 'Elevação pélvica (hip thrust)', 'Pernas', 'Barra', {
    increment: 5, muscles: 'Glúteos, posteriores',
    steps: ['Parte alta das costas apoiada no banco, barra sobre o quadril (use protetor).', 'Pés firmes, canelas verticais no topo.', 'Suba o quadril até alinhar tronco e coxas e contraia os glúteos.', 'Desça controlado.'],
    mistakes: 'Hiperestender a lombar no topo.', alternatives: 'Glute bridge ou máquina de glúteo' }),
  ex('afundo', 'Afundo (halteres)', 'Pernas', 'Halter', {
    perSide: true, increment: 2, muscles: 'Quadríceps, glúteos',
    steps: ['Halteres ao lado do corpo, dê um passo largo à frente.', 'Desça até o joelho de trás quase tocar o chão.', 'Volte empurrando pelo pé da frente.'],
    mistakes: 'Joelho da frente colapsando para dentro.', alternatives: 'Búlgaro ou passada' }),
  ex('crucifixo', 'Crucifixo (halteres)', 'Peito', 'Halter', {
    perSide: true, increment: 2, muscles: 'Peitoral',
    steps: ['Deitado, halteres acima do peito com cotovelos levemente flexionados.', 'Abra os braços em arco até sentir o alongamento.', 'Feche como se abraçasse uma árvore.'],
    mistakes: 'Descer demais e forçar o ombro.', alternatives: 'Crossover ou peck deck' }),
  ex('supino_maquina', 'Supino máquina', 'Peito', 'Máquina', {
    increment: 5, muscles: 'Peitoral, tríceps',
    steps: ['Ajuste o banco para as pegadas ficarem na linha do meio do peito.', 'Escápulas retraídas, empurre até quase estender.', 'Volte devagar.'],
    mistakes: 'Ombros subindo em direção às orelhas.', alternatives: 'Supino com halteres' }),
  ex('remada_curvada', 'Remada curvada (barra)', 'Costas', 'Barra', {
    barbell: true, increment: 2.5, muscles: 'Dorsais, romboides, eretores',
    steps: ['Tronco inclinado ~45°, costas neutras, joelhos levemente flexionados.', 'Puxe a barra em direção ao umbigo.', 'Desça controlado sem mudar a posição do tronco.'],
    mistakes: 'Levantar o tronco a cada repetição.', alternatives: 'Remada apoiada ou máquina' }),
  ex('face_pull', 'Face pull', 'Ombros', 'Cabo', {
    increment: 2.5, muscles: 'Deltoide posterior, manguito rotador',
    steps: ['Polia na altura do rosto, corda com pegada neutra.', 'Puxe em direção ao rosto abrindo os cotovelos.', 'Gire as mãos para trás no fim e volte devagar.'],
    mistakes: 'Usar carga demais e puxar com o tronco.', alternatives: 'Crucifixo inverso' }),
  ex('elevacao_lateral', 'Elevação lateral', 'Ombros', 'Halter', {
    perSide: true, increment: 1, muscles: 'Deltoide lateral',
    steps: ['Em pé, halteres ao lado do corpo, cotovelos levemente flexionados.', 'Eleve os braços para os lados até a altura dos ombros.', 'Desça devagar.'],
    mistakes: 'Balançar o corpo e subir os ombros.', alternatives: 'Elevação lateral no cabo' }),
  ex('rosca_direta', 'Rosca direta', 'Bíceps', 'Barra', {
    increment: 2, muscles: 'Bíceps, braquial',
    steps: ['Em pé, pegada supinada na largura dos ombros.', 'Flexione os cotovelos sem movê-los para frente.', 'Desça até estender os braços.'],
    mistakes: 'Jogar o tronco para trás para subir.', alternatives: 'Rosca alternada ou no cabo' }),
  ex('rosca_alternada', 'Rosca alternada', 'Bíceps', 'Halter', {
    perSide: true, increment: 1, muscles: 'Bíceps',
    steps: ['Halteres ao lado do corpo, palmas para dentro.', 'Suba um braço girando a palma para cima.', 'Desça devagar e alterne.'],
    mistakes: 'Balançar o corpo.', alternatives: 'Rosca martelo' }),
  ex('triceps_corda', 'Tríceps na polia (corda)', 'Tríceps', 'Cabo', {
    increment: 2.5, muscles: 'Tríceps',
    steps: ['Cotovelos colados ao corpo, corda na altura do peito.', 'Estenda os cotovelos abrindo a corda no fim.', 'Volte até ~90° sem mover os cotovelos.'],
    mistakes: 'Cotovelos se afastando do corpo.', alternatives: 'Tríceps testa ou mergulho' }),
  ex('triceps_frances', 'Tríceps francês (halter)', 'Tríceps', 'Halter', {
    increment: 2, muscles: 'Tríceps (cabeça longa)',
    steps: ['Sentado, halter acima da cabeça com as duas mãos.', 'Desça atrás da cabeça flexionando os cotovelos.', 'Estenda de volta sem abrir os cotovelos.'],
    mistakes: 'Arquear a lombar.', alternatives: 'Tríceps na polia acima da cabeça' }),
  ex('prancha', 'Prancha', 'Core', 'Peso corporal', {
    type: 'time', increment: 0, muscles: 'Core anti-extensão',
    steps: ['Antebraços no chão sob os ombros, corpo em linha reta.', 'Contraia abdômen e glúteos.', 'Mantenha a posição respirando normalmente.'],
    mistakes: 'Quadril caído ou empinado.', alternatives: 'Dead bug' }),
  ex('abdominal_cabo', 'Abdominal na polia', 'Core', 'Cabo', {
    increment: 5, muscles: 'Reto abdominal',
    steps: ['Ajoelhado de frente para a polia alta, corda junto à cabeça.', 'Flexione o tronco levando os cotovelos em direção aos joelhos.', 'Volte devagar.'],
    mistakes: 'Puxar com os braços em vez do abdômen.', alternatives: 'Abdominal supra' }),
];

const item = (id, exerciseId, sets, repsMin, repsMax, restSec, o = {}) => ({
  id, exerciseId, sets, repsMin, repsMax, restSec, linkNext: false, progression: 'double', increment: null, note: '', ...o,
});

// Supersets do artefato (3A+3B, 4A+4B, 5A+5B): o "A" tem descanso curto e liga no próximo.
export const SEED_PLANS = [
  {
    id: 'plan-a', name: 'Treino A', subtitle: 'Agachamento e supino', order: 0, updatedAt: 0, deleted: false,
    items: [
      item('a1', 'boxjump', 3, 3, 3, 60, { progression: 'none', note: 'Máxima altura, aterrissagem suave' }),
      item('a2', 'agachamento', 3, 5, 6, 120),
      item('a3', 'supino', 3, 6, 8, 20, { linkNext: true }),
      item('a4', 'remada_halter', 3, 8, 10, 90, { note: 'Carga por halter' }),
      item('a5', 'desenvolvimento', 2, 8, 10, 20, { linkNext: true, note: 'Carga por halter' }),
      item('a6', 'puxada', 2, 10, 12, 60),
      item('a7', 'pallof', 2, 10, 10, 20, { linkNext: true, note: '10 por lado' }),
      item('a8', 'panturrilha', 2, 12, 15, 45),
    ],
  },
  {
    id: 'plan-b', name: 'Treino B', subtitle: 'Terra romeno e barra fixa', order: 1, updatedAt: 0, deleted: false,
    items: [
      item('b1', 'broadjump', 3, 3, 3, 60, { progression: 'none', note: 'Máxima distância, aterrissagem controlada' }),
      item('b2', 'terra_romeno', 3, 6, 8, 120),
      item('b3', 'barra_fixa', 3, 5, 8, 20, { linkNext: true, note: 'Carga = peso extra (0 se só o corpo)' }),
      item('b4', 'supino_inclinado', 3, 8, 10, 90, { note: 'Carga por halter' }),
      item('b5', 'bulgaro', 2, 8, 8, 20, { linkNext: true, note: '8 por perna, carga por halter' }),
      item('b6', 'remada_baixa', 2, 10, 12, 60),
      item('b7', 'roda', 2, 8, 10, 20, { linkNext: true }),
      item('b8', 'panturrilha_uni', 2, 12, 12, 45, { note: '12 por perna' }),
    ],
  },
];
