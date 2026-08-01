// =======================================================
// FOCUS · BIBLIOTECA DE ESTUDIOS (52 semanas, un año completo)
// Cada estudio: fuente real, hallazgo, y "apply" que lo
// personaliza con los datos del usuario.
//
// apply(s) recibe:
//   s.weekMin      minutos de la semana
//   s.weekSess     sesiones/votos de la semana
//   s.activeDays   días activos de la semana (0-7)
//   s.lifetimeH    horas totales acumuladas en FOCUS
//   s.hasReason    si tiene su porqué escrito
//   s.domLabel     etiqueta de su categoría dominante (o null)
//
// Rotación determinista anclada al lunes: getWeeklyStudy(weekKey)
// devuelve siempre el mismo estudio para la misma semana, en
// cualquier dispositivo y sin servidor.
//
// Nota editorial: se han excluido deliberadamente estudios que no
// superaron la crisis de replicación (ego depletion, power posing,
// marshmallow test sin matices) para proteger la credibilidad.
// =======================================================

const h = (n) => n.toFixed(1);

export const STUDY_LIBRARY = [
  // --- BLOQUE 1: escribir, empezar, formar el hábito ---
  {
    source: "Gail Matthews · Dominican University of California",
    claim: "Las personas que escriben sus objetivos tienen una probabilidad significativamente mayor de cumplirlos que quienes solo los piensan — y más aún si revisan su progreso con regularidad.",
    apply: (s) => s.hasReason
      ? "Tu porqué está escrito y cada semana repasas tu progreso aquí: estás haciendo exactamente las dos cosas que este estudio recomienda."
      : "Todavía no tienes tu porqué escrito. Según este estudio, es la inversión de un minuto más rentable que existe."
  },
  {
    source: "Phillippa Lally et al. · European Journal of Social Psychology, 2010",
    claim: "Automatizar un hábito tarda de media 66 días (entre 18 y 254 según la persona y la conducta). Saltarse un día aislado no daña el proceso: lo que importa es la tendencia.",
    apply: (s) => `Tus ${s.activeDays} día${s.activeDays === 1 ? '' : 's'} activo${s.activeDays === 1 ? '' : 's'} de esta semana son exactamente el material del que se fabrican esos 66 días.`
  },
  {
    source: "Wendy Wood & Dennis Quinn · Journal of Personality and Social Psychology, 2002",
    claim: "Alrededor del 43% de lo que hacemos cada día no son decisiones: son hábitos que se ejecutan solos mientras pensamos en otra cosa.",
    apply: (s) => `Cada sesión que registras es un intento de poner ese 43% a trabajar a tu favor. Esta semana lo intentaste ${s.weekSess} ${s.weekSess === 1 ? 'vez' : 'veces'}.`
  },
  {
    source: "Karl Weick · American Psychologist, 1984",
    claim: "Las \"pequeñas victorias\": los objetivos enormes paralizan, pero una cadena de logros pequeños y concretos genera la sensación de control que hace posible lo grande.",
    apply: (s) => s.weekSess > 0
      ? `Tus ${s.weekSess} sesiones de esta semana son ${s.weekSess} pequeñas victorias encadenadas. Así se construye lo imposible.`
      : "Tu próxima sesión será tu próxima pequeña victoria. Weick demostró que con eso basta para empezar."
  },
  {
    source: "Teresa Amabile & Steven Kramer · Harvard Business Review, 2011",
    claim: "El \"principio del progreso\": tras analizar 12.000 diarios personales, descubrieron que de todo lo que sostiene la motivación, ver progreso propio — aunque sea mínimo — es lo que más pesa.",
    apply: (s) => `Este resumen semanal existe por este estudio: ${s.weekMin} minutos que sin FOCUS habrían sido invisibles, ahora son progreso que puedes ver.`
  },
  {
    source: "Peter Gollwitzer · American Psychologist, 1999",
    claim: "Las \"intenciones de implementación\": decidir por adelantado cuándo y dónde actuarás (\"si es X, entonces hago Y\") multiplica la probabilidad de hacerlo, porque le quita la decisión al momento de pereza.",
    apply: () => "Prueba esta semana: no digas \"voy a entrenar\", di \"al cerrar el portátil a las 18:00, me pongo las zapatillas\". El pacto que sellaste va de esto."
  },
  {
    source: "Gollwitzer & Sheeran · Advances in Experimental Social Psychology, 2006",
    claim: "Meta-análisis de 94 estudios: planear el cuándo y el dónde de una conducta tiene un efecto medio-grande (d ≈ 0,65) sobre cumplirla de verdad. Uno de los efectos más sólidos de toda la psicología.",
    apply: (s) => `Aplícalo a tu foco principal${s.domLabel ? ` (${s.domLabel.toLowerCase()})` : ''}: elige ahora el momento exacto de tu próxima sesión y anótalo donde lo veas.`
  },
  {
    source: "Benjamin Gardner, Phillippa Lally & Jane Wardle · British Journal of General Practice, 2012",
    claim: "Para consolidar un hábito importa más la constancia del contexto (misma hora, mismo lugar, misma señal) que la intensidad. Fallar un día no rompe nada; cambiar de contexto cada vez, sí.",
    apply: (s) => `Mira tus ${s.activeDays} día${s.activeDays === 1 ? '' : 's'} activo${s.activeDays === 1 ? '' : 's'}: ¿fueron a horas parecidas? Si no, elegir una hora fija puede ser tu mayor mejora gratis.`
  },
  {
    source: "Ann Graybiel & Kyle Smith · MIT, Neuron, 2013",
    claim: "El cerebro \"empaqueta\" las conductas repetidas en los ganglios basales: al principio cuesta atención y voluntad, después se ejecuta como un solo bloque automático que casi no consume energía.",
    apply: (s) => `Cada repetición de esta semana (${s.weekSess}) fue una pasada más del empaquetado. Lo que hoy cuesta, tu cerebro lo está convirtiendo en gratis.`
  },
  {
    source: "Bas Verplanken & Wendy Wood · Journal of Public Policy & Marketing, 2006",
    claim: "La \"hipótesis de la discontinuidad del hábito\": los hábitos viejos se rompen más fácil cuando cambia el contexto (mudanza, trabajo nuevo, mes nuevo), porque desaparecen las señales que los disparaban.",
    apply: () => "¿Algún cambio de rutina a la vista? No es una amenaza: es la ventana que la ciencia señala como el mejor momento para instalar el hábito que quieres."
  },

  // --- BLOQUE 2: identidad ---
  {
    source: "Daryl Bem · Advances in Experimental Social Psychology, 1972",
    claim: "Teoría de la autopercepción: deducimos quiénes somos observando lo que hacemos. No actúas como eres; acabas siendo como actúas.",
    apply: (s) => `Esta semana te viste a ti mismo actuar ${s.weekSess} ${s.weekSess === 1 ? 'vez' : 'veces'}. Según Bem, eso no solo suma minutos: reescribe quién crees que eres.`
  },
  {
    source: "Christopher Bryan et al. · PNAS, 2011",
    claim: "Preguntar \"¿serás votante?\" en vez de \"¿votarás?\" aumentó la participación real: cuando la conducta se formula como identidad (sustantivo) y no como acción (verbo), pesa mucho más.",
    apply: (s) => s.domLabel
      ? `No digas "hago ${s.domLabel.toLowerCase()}". Di "soy alguien de ${s.domLabel.toLowerCase()}". El lenguaje que usas contigo mueve conducta real.`
      : "No digas \"lo intento\". Di \"soy alguien que aparece\". La formulación en identidad mueve conducta real."
  },
  {
    source: "Angela Duckworth et al. · Journal of Personality and Social Psychology, 2007",
    claim: "El \"grit\" — pasión y perseverancia sostenidas por objetivos a largo plazo — predice el éxito en contextos tan duros como West Point mejor que el talento o el CI.",
    apply: (s) => `El grit no se mide en un día bueno: se mide en volver. Llevas ${h(s.lifetimeH)} horas volviendo.`
  },
  {
    source: "Angela Duckworth & Martin Seligman · Psychological Science, 2005",
    claim: "En estudiantes, la autodisciplina predijo las notas finales el doble de bien que el CI. Lo que haces con constancia le gana a lo que eres \"de serie\".",
    apply: (s) => `Nadie te pidió talento esta semana. Te pediste ${s.weekMin} minutos, y los pusiste. Esa es la variable que más predice.`
  },
  {
    source: "Terrie Moffitt et al. · PNAS, 2011 (Estudio Dunedin, 1.000 personas seguidas 32 años)",
    claim: "El autocontrol en la infancia predijo salud, finanzas y bienestar en la vida adulta — con independencia del CI y de la clase social. Y lo crucial: el autocontrol se puede entrenar a cualquier edad.",
    apply: () => "Cada sesión registrada en FOCUS es literalmente una repetición del músculo que este estudio siguió durante 32 años."
  },
  {
    source: "Carol Dweck & Lisa Blackwell · Child Development, 2007",
    claim: "Los estudiantes que aprendieron que la habilidad crece con el esfuerzo (mentalidad de crecimiento) mejoraron sus notas de forma sostenida; los que creían que \"se es o no se es\", se estancaron.",
    apply: (s) => `Tus datos son el argumento contra el "no valgo para esto": hace unas semanas no tenías ${h(s.lifetimeH)} horas. Ahora sí. Algo creció.`
  },
  {
    source: "Albert Bandura · Psychological Review, 1977",
    claim: "La autoeficacia — creer que puedes — es el mejor predictor de intentarlo y de aguantar. Y su fuente más potente no son los ánimos: son tus propios logros previos, verificables.",
    apply: (s) => `Por eso FOCUS guarda todo: tus ${h(s.lifetimeH)} horas son evidencia dura de que puedes, la próxima vez que tu cabeza lo dude.`
  },
  {
    source: "Albert Bandura & Dale Schunk · Journal of Personality and Social Psychology, 1981",
    claim: "Niños con metas próximas y pequeñas (\"6 páginas hoy\") superaron con mucho a los que tenían la misma meta pero lejana (\"42 páginas esta semana\") — en rendimiento, interés y confianza.",
    apply: () => "Tu pacto semanal funciona por esto: una meta a 7 días vista está lo bastante cerca para empujar hoy."
  },

  // --- BLOQUE 3: motivación y recompensa ---
  {
    source: "Edward Deci & Richard Ryan · Psychological Inquiry, 2000",
    claim: "Teoría de la autodeterminación: la motivación que dura nace de tres nutrientes — autonomía (lo elijo yo), competencia (se me da cada vez mejor) y vínculo (no estoy solo en esto).",
    apply: (s) => `FOCUS te da los tres: elegiste tú tus categorías, tus gráficas muestran competencia creciente, y el Social Club es el vínculo. ${s.weekSess > 0 ? 'Esta semana alimentaste los tres.' : 'Esta semana puedes alimentar los tres.'}`
  },
  {
    source: "Kaitlin Woolley & Ayelet Fishbach · Personality and Social Psychology Bulletin, 2017",
    claim: "Lo que predice si la gente persiste en sus propósitos no es la recompensa futura: es cuánto disfrutan el proceso en el momento. La recompensa inmediata gana a la lejana.",
    apply: () => "Truco respaldado por este estudio: junta tu hábito con algo que te guste ya (tu música, tu café, tu sitio favorito). No es hacer trampa; es ingeniería."
  },
  {
    source: "Katy Milkman et al. · Management Science, 2014",
    claim: "\"Temptation bundling\": permitirse un placer (audiolibros adictivos) solo durante el hábito (ir al gimnasio) aumentó la asistencia de forma significativa.",
    apply: (s) => s.domLabel
      ? `¿Qué placer podrías reservar exclusivamente para tus sesiones de ${s.domLabel.toLowerCase()}? Ese "solo si" es el mecanismo del estudio.`
      : "Reserva un placer concreto exclusivamente para tus sesiones. Ese \"solo si\" es el mecanismo del estudio."
  },
  {
    source: "Hengchen Dai, Katy Milkman & Jason Riis · Management Science, 2014",
    claim: "El \"efecto borrón y cuenta nueva\": las búsquedas de \"dieta\", las visitas al gimnasio y los compromisos se disparan en fechas-frontera (lunes, día 1, cumpleaños), porque separan al \"yo antiguo\" del nuevo.",
    apply: () => "Por eso tu wrap llega al empezar la semana: cada lunes es, según los datos, la frontera psicológica perfecta para renovar el pacto."
  },
  {
    source: "Clark Hull, 1932 · replicado por Kivetz, Urminsky & Zheng · Journal of Marketing Research, 2006",
    claim: "El \"gradiente de meta\": cuanto más cerca se percibe el objetivo, más se acelera — las personas con tarjetas de fidelidad compran más rápido cuando les faltan pocos sellos.",
    apply: (s) => `Mira tu barra hacia las próximas 25 horas: cuanto más se llena, más fuerte tira de ti. Llevas ${h(s.lifetimeH)}h — úsalo a tu favor.`
  },
  {
    source: "Joseph Nunes & Xavier Drèze · Journal of Consumer Research, 2006",
    claim: "El \"progreso dotado\": una tarjeta de 10 sellos con 2 ya puestos se completa mucho más que una de 8 vacía — el mismo esfuerzo se siente distinto si ya estás \"en camino\".",
    apply: (s) => `Nunca empiezas de cero: cada semana arranca con tus ${h(s.lifetimeH)} horas ya puestas. Ya estás en camino; solo continúas.`
  },
  {
    source: "Minjung Koo & Ayelet Fishbach · Journal of Personality and Social Psychology, 2012",
    claim: "Para motivarse conviene mirar \"el área pequeña\": al principio, lo ya avanzado (\"¡llevo 3 días!\"); cerca del final, lo que falta (\"solo quedan 2\"). Mirar siempre lo mismo desmotiva.",
    apply: (s) => s.activeDays <= 3
      ? `Estás empezando la semana: mira lo ganado — ${s.activeDays} día${s.activeDays === 1 ? '' : 's'} ya en el bolsillo.`
      : `Vas avanzado: mira lo que falta — solo ${7 - s.activeDays} día${7 - s.activeDays === 1 ? '' : 's'} para una semana completa.`
  },
  {
    source: "Edwin Locke & Gary Latham · American Psychologist, 2002 (35 años de investigación)",
    claim: "Las metas específicas y difíciles producen mejor rendimiento que \"hazlo lo mejor que puedas\". La vaguedad es el enemigo silencioso del esfuerzo.",
    apply: () => "Tu pacto de esta semana tiene número y fecha. Eso no es un detalle estético: es la condición que 35 años de estudios señalan como imprescindible."
  },
  {
    source: "Daniel Kahneman & Amos Tversky · Econometrica, 1979",
    claim: "Aversión a la pérdida: perder algo duele aproximadamente el doble de lo que alegra ganarlo. Es una de las fuerzas más potentes de la conducta humana.",
    apply: (s) => s.activeDays > 0
      ? "Tu racha convierte esta fuerza en aliada: no seguir ya no es \"no ganar un día\" — es perder algo tuyo. Y odiamos perder."
      : "Empieza una racha esta semana: en cuanto exista, la aversión a la pérdida trabajará para ti gratis."
  },

  // --- BLOQUE 4: planes, plazos y compromiso ---
  {
    source: "Dan Ariely & Klaus Wertenbroch · Psychological Science, 2002",
    claim: "Los estudiantes que se autoimpusieron fechas límite rindieron mejor que los que no tenían ninguna. Atarse las manos voluntariamente funciona.",
    apply: () => "Tu pacto semanal es exactamente eso: una atadura voluntaria de 7 días. Ariely demostró que quienes se atan, llegan."
  },
  {
    source: "Bluma Zeigarnik · Psychologische Forschung, 1927",
    claim: "El efecto Zeigarnik: las tareas empezadas y no terminadas ocupan la mente mucho más que las completadas. Lo inacabado \"tira\" de nosotros.",
    apply: () => "Úsalo: si un día no tienes fuerzas, solo empieza — 2 minutos. Lo inacabado hará el resto del trabajo psicológico por ti."
  },
  {
    source: "John Norcross et al. · Journal of Clinical Psychology, 2002",
    claim: "Seis meses después de Año Nuevo, quienes hicieron propósitos formales mantenían el cambio unas 10 veces más que quienes querían lo mismo pero sin compromiso explícito.",
    apply: (s) => s.hasReason
      ? "Tú hiciste el compromiso formal el primer día, cuando escribiste tu porqué. Estás en el grupo de los 10x."
      : "Formaliza tu compromiso escribiendo tu porqué: el salto entre \"querer\" y \"comprometerse\" es de 10 a 1."
  },
  {
    source: "John Hollenbeck, Charles Williams & Howard Klein · Journal of Applied Psychology, 1989",
    claim: "Hacer públicas las metas aumenta el compromiso con ellas: lo que otros saben de ti, te cuesta más abandonarlo.",
    apply: () => "Para eso existe el botón de compartir tu carta semanal: no es postureo, es tecnología de compromiso con base empírica."
  },
  {
    source: "Gabriele Oettingen · \"Rethinking Positive Thinking\", 20 años de estudios (NYU)",
    claim: "Solo visualizar el éxito relaja y desactiva. Lo que funciona es el \"contraste mental\": imaginar el objetivo Y el obstáculo concreto que se interpondrá, con un plan para ese obstáculo.",
    apply: () => "Hazlo ahora en 30 segundos: ¿cuál será EL obstáculo de esta semana? Nómbralo. Decide qué harás cuando aparezca. Eso es WOOP."
  },
  {
    source: "Lien Pham & Shelley Taylor · Personality and Social Psychology Bulletin, 1999",
    claim: "Estudiantes que visualizaron el proceso de estudiar sacaron mejores notas que los que visualizaron la nota final. Simular el camino gana a soñar el destino.",
    apply: (s) => s.domLabel
      ? `No te imagines "logrado". Imagínate mañana, a la hora exacta, haciendo tu sesión de ${s.domLabel.toLowerCase()}. Esa película sí mueve conducta.`
      : "No te imagines \"logrado\". Imagínate mañana, a la hora exacta, en plena sesión. Esa película sí mueve conducta."
  },

  // --- BLOQUE 5: el yo futuro ---
  {
    source: "Hal Hershfield et al. · Journal of Marketing Research, 2011",
    claim: "Cuando las personas ven a su yo futuro de forma vívida (incluso con fotos envejecidas), sacrifican más en el presente por él. La distancia con tu yo futuro se puede acortar — y cambia decisiones.",
    apply: () => "La pestaña \"Yo futuro\" de tu Legacy existe por este estudio. Visítala esta semana: cada minuto de conexión con ese yo es inversión."
  },
  {
    source: "Emily Pronin et al. · Personality and Social Psychology Bulletin, 2008",
    claim: "El cerebro trata al yo futuro casi como a un desconocido: por eso le encargamos las tareas duras (\"ya lo haré\"). Reconocerlo es el primer paso para dejar de estafarle.",
    apply: (s) => `Esta semana le regalaste ${s.weekMin} minutos a ese "desconocido". Cada sesión es un acto de justicia con la persona que serás.`
  },
  {
    source: "Daniel Kahneman et al. · Psychological Science, 1993",
    claim: "La \"regla del pico y el final\": recordamos las experiencias por su mejor/peor momento y por cómo terminan — no por su duración media.",
    apply: () => "Termina cada sesión un punto antes del agotamiento, con una nota buena. Tu memoria archivará el hábito como algo que quieres repetir."
  },

  // --- BLOQUE 6: lo social ---
  {
    source: "Nicholas Christakis & James Fowler · New England Journal of Medicine, 2007",
    claim: "Siguiendo a 12.000 personas durante 32 años: los hábitos se contagian por la red social — la probabilidad de un cambio sube si tu gente cercana lo hace, hasta a tres grados de distancia.",
    apply: () => "Cada carta que compartes en el Social Club no solo te compromete a ti: literalmente sube la probabilidad de que tu gente también empiece."
  },
  {
    source: "Damon Centola · Science, 2010",
    claim: "Las conductas de esfuerzo (no los simples rumores) se propagan mejor en redes agrupadas, donde ves a varias personas conocidas haciéndolo — no basta un influencer lejano.",
    apply: () => "Una comunidad pequeña donde os veis progresar unos a otros vale más que mil seguidores. Es exactamente lo que son las Communities de FOCUS."
  },
  {
    source: "Norman Triplett · American Journal of Psychology, 1898 (el primer experimento de psicología social)",
    claim: "Los ciclistas pedalean más rápido en presencia de otros que solos contra el reloj. La mera presencia de otros eleva el rendimiento.",
    apply: () => "126 años después sigue vigente: entrenar, leer o estudiar \"en compañía\" (aunque sea virtual) extrae un rendimiento que a solas no aparece."
  },
  {
    source: "Norbert Köhler, años 20 · confirmado por Deborah Feltz & Norbert Kerr (Michigan State)",
    claim: "El \"efecto Köhler\": ejercitarse junto a alguien ligeramente mejor que tú aumenta la persistencia hasta un 100% — nadie quiere ser el eslabón débil.",
    apply: () => "En el Social Club, sigue a alguien que vaya un paso por delante. No para compararte mal: para activar este efecto a tu favor."
  },
  {
    source: "Gregory Walton & Geoffrey Cohen · Science, 2011",
    claim: "Una intervención de 1 hora sobre el sentido de pertenencia (\"aquí todos dudan al principio, y se pasa\") mejoró el rendimiento y la salud de estudiantes durante 3 años.",
    apply: () => "Si esta semana sentiste que \"esto no es para ti\": es la señal más común del principio, no una verdad sobre ti. A todos les pasa. Y se pasa."
  },

  // --- BLOQUE 7: mente y cuerpo (los hábitos que registras) ---
  {
    source: "Britta Hölzel, Sara Lazar et al. · Psychiatry Research: Neuroimaging, 2011",
    claim: "Ocho semanas de meditación (unos 27 min/día) produjeron cambios medibles en la densidad de materia gris: más hipocampo (aprendizaje, memoria), menos reactividad en la amígdala (estrés).",
    apply: (s) => "Cuando registras meditación en FOCUS no apuntas \"relax\": apuntas remodelación cerebral literal, verificada por resonancia."
  },
  {
    source: "Kirk Erickson et al. · PNAS, 2011",
    claim: "Un año de ejercicio aeróbico regular aumentó el tamaño del hipocampo un 2% en adultos mayores — revirtiendo en la práctica 1-2 años de envejecimiento cerebral.",
    apply: () => "Tus sesiones de entrenamiento no solo construyen cuerpo: reconstruyen el órgano con el que recordarás todo lo demás."
  },
  {
    source: "Avni Bavishi, Martin Slade & Becca Levy · Social Science & Medicine, 2016 (Yale, 3.635 personas, 12 años)",
    claim: "Los lectores de libros vivieron de media 23 meses más que los no lectores, controlando salud, riqueza y educación. Capítulos = esperanza de vida.",
    apply: (s) => `Cada sesión de lectura que registras está, según Yale, comprándote tiempo. Literalmente.`
  },
  {
    source: "David Kidd & Emanuele Castano · Science, 2013",
    claim: "Leer ficción literaria mejora la \"teoría de la mente\": la capacidad de entender qué piensan y sienten los demás. Los libros entrenan la empatía como un gimnasio.",
    apply: () => "Tu estantería de Books en FOCUS es también tu registro de entrenamiento social. Cada novela terminada, una sesión de empatía."
  },
  {
    source: "Matthew Walker & Robert Stickgold · Neuron (síntesis de décadas de estudios sobre sueño)",
    claim: "El aprendizaje del día se consolida durante el sueño: dormir después de practicar mejora la retención y la habilidad motora sin práctica adicional. Dormir ES parte del entrenamiento.",
    apply: (s) => `Esas horas de sueño que registras no son "tiempo muerto" entre sesiones: son la mitad silenciosa de tus ${s.weekMin} minutos de esta semana.`
  },
  {
    source: "Gregory Bratman et al. · PNAS, 2015 (Stanford)",
    claim: "Un paseo de 90 minutos en la naturaleza redujo la rumiación (los pensamientos negativos en bucle) y la actividad de la zona cerebral asociada — el mismo paseo en la ciudad, no.",
    apply: () => "Si esta semana tu cabeza entró en bucle, la receta con evidencia es la más antigua: verde, andar, sin móvil. Cuenta como sesión de cuidarte."
  },
  {
    source: "Sophie Leroy · Organizational Behavior and Human Decision Processes, 2009",
    claim: "El \"residuo de atención\": al saltar de una tarea a otra, parte de la mente se queda en la anterior. Los bloques de foco puro rinden desproporcionadamente más que el mismo tiempo fragmentado.",
    apply: (s) => `Tus ${s.weekMin} minutos valen más si vienen en bloques: una sesión de 30 min enfocada rinde más que 3 de 10 salpicadas. Calidad del minuto, no solo cantidad.`
  },

  // --- BLOQUE 8: caerse y levantarse ---
  {
    source: "Janet Polivy & Peter Herman · investigación sobre el efecto \"what-the-hell\"",
    claim: "El mayor peligro tras romper una regla no es el desliz: es el \"ya qué más da\" que convierte un fallo puntual en abandono total. El desliz no destruye el progreso; la interpretación del desliz, sí.",
    apply: () => "Grábatelo para cuando pase: un día perdido es un dato. \"Ya qué más da\" es una decisión. FOCUS te enseñará el dato para que no tomes la decisión."
  },
  {
    source: "Michael Wohl et al. · Personality and Individual Differences, 2010",
    claim: "Los estudiantes que se perdonaron por procrastinar antes de un examen procrastinaron menos en el siguiente. Machacarse no corrige: perdonarse libera recursos para corregir.",
    apply: (s) => s.activeDays < 4
      ? "Si esta semana fue floja: perdónatela hoy, formalmente. Según este estudio, es lo más productivo que puedes hacer por la que empieza."
      : "Guarda este estudio para tu próxima semana floja: perdonártela rápido será lo más productivo que puedas hacer."
  },
  {
    source: "Juliana Breines & Serena Chen · Personality and Social Psychology Bulletin, 2012",
    claim: "La autocompasión tras un fallo no ablanda: aumenta la motivación de mejora, el tiempo de estudio posterior y la voluntad de reparar. Tratarse como a un buen amigo rinde más que el látigo.",
    apply: () => "La próxima vez que falles, pregúntate: ¿qué le diría a mi mejor amigo si le pasara esto? Dítelo. Y luego, a la siguiente sesión."
  },
  {
    source: "James Pennebaker · décadas de estudios sobre escritura expresiva (UT Austin)",
    claim: "Escribir 15-20 minutos sobre lo que a uno le pesa, unos pocos días seguidos, mejora de forma medible la salud física y mental. Poner palabras ordena lo que pesa.",
    apply: (s) => s.hasReason
      ? "Ya escribiste una vez lo que te mueve (tu porqué). Cuando algo te pese esta semana, repite la operación: papel, 15 minutos, sin filtro."
      : "Cuando algo te pese esta semana: papel, 15 minutos, sin filtro. Y de paso, escribe tu porqué — matas dos pájaros con evidencia."
  },
  {
    source: "Alia Crum & Ellen Langer · Psychological Science, 2007",
    claim: "Camareras de hotel a las que se les explicó que su trabajo ya era ejercicio mejoraron peso y tensión arterial sin cambiar nada más. Cómo interpretas lo que haces cambia lo que te hace.",
    apply: (s) => `Esto es FOCUS en una frase: tus ${s.weekMin} minutos existían igual, pero verlos como progreso los convierte fisiológicamente en otra cosa.`
  },
  {
    source: "Alia Crum, Peter Salovey & Shawn Achor · Journal of Personality and Social Psychology, 2013",
    claim: "Ver el estrés como \"algo que me prepara\" en vez de \"algo que me daña\" mejora el rendimiento y la respuesta fisiológica ante el mismo estrés objetivo.",
    apply: () => "Los nervios antes de una sesión difícil no son la señal de parar: son el cuerpo subiendo revoluciones para dártelo. Reinterpretarlo ya es la mitad."
  },
  {
    source: "Robert Emmons & Michael McCullough · Journal of Personality and Social Psychology, 2003",
    claim: "Anotar semanalmente cosas por las que estar agradecido mejoró el bienestar, el optimismo e incluso el ejercicio físico frente a anotar molestias o eventos neutros.",
    apply: (s) => `Cierra esta semana con un apunte de gratitud: incluye tus ${s.activeDays} día${s.activeDays === 1 ? '' : 's'} activo${s.activeDays === 1 ? '' : 's'} en la lista. Cuentan.`
  },
  {
    source: "BJ Fogg · Stanford Behavior Design Lab, \"Tiny Habits\" (2020)",
    claim: "Lo que fija un hábito no es la repetición a secas: es la emoción positiva inmediata. Celebrar en pequeño justo después de actuar (\"¡bien!\") le dice al cerebro \"esto se repite\".",
    apply: () => "Instrucción literal del método: al terminar tu próxima sesión, celébralo físicamente 3 segundos — puño, sonrisa, lo que sea. Sella el circuito."
  }
];

// Semana anclada al lunes: mismo estudio para todos, toda la semana,
// sin servidor. weekKey = "YYYY-MM-DD" del lunes (como en weekly-wrap.js).
export function getWeeklyStudy(weekKey) {
  const [y, m, d] = weekKey.split("-").map(Number);
  const monday = Date.UTC(y, m - 1, d);
  const anchor = Date.UTC(2024, 0, 1); // 1 ene 2024 fue lunes
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  const weekIndex = Math.round((monday - anchor) / MS_WEEK);
  const idx = ((weekIndex % STUDY_LIBRARY.length) + STUDY_LIBRARY.length) % STUDY_LIBRARY.length;
  return { study: STUDY_LIBRARY[idx], index: idx, total: STUDY_LIBRARY.length };
}
