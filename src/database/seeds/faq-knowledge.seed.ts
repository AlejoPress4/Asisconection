import type { DataSource } from 'typeorm';
import { FaqKnowledge } from '../../modules/assistant/entities/faq-knowledge.entity';

interface FaqSeedItem {
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

const DEFAULT_FAQS: ReadonlyArray<FaqSeedItem> = [
  {
    category: 'Sobre el síndrome de Down',
    question: '¿Qué es el síndrome de Down y cómo acompaña ASISCO UP a las familias?',
    answer:
      'El síndrome de Down (trisomía 21) es una condición genética natural, no una enfermedad. En la Fundación ASISCO UP acompañamos a cada persona y su familia desde la primera infancia hasta la vida adulta con programas pedagógicos, artísticos y comunitarios.',
  },
  {
    category: 'Citas y terapias en ASISCO UP',
    question: '¿Cómo agendo una cita de valoración o acompañamiento en ASISCO UP?',
    answer:
      'Puedes solicitar tu cita inicial comunicándote por nuestro canal oficial de WhatsApp desde el botón «Hablar con una persona» o acercándote a la sede principal en Manizales con el documento de identidad del beneficiario y del acudiente.',
  },
  {
    category: 'Derechos, EPS y trámites',
    question: '¿Cómo gestionar autorizaciones de terapias integrales ante la EPS?',
    answer:
      'En Colombia, la Ley Estatutaria de Salud y la Ley 1618 garantizan la atención integral sin barreras administrativas. Conserva la orden médica con el plan terapéutico detallado y, si requieres orientación en derechos o tutelas, nuestro equipo de apoyo familiar te asesora gratuitamente.',
  },
  {
    category: 'Desarrollo y crianza',
    question: '¿Qué actividades de estimulación temprana puedo realizar en casa?',
    answer:
      'Prioriza rutinas cortas de juego sensorial, lectura compartida, canciones con gestos y fortalecimiento motriz respetando el ritmo propio de tu hijo o hija. En la categoría Guías del foro encontrarás ejercicios recomendados por nuestras terapeutas.',
  },
  {
    category: 'Talleres y comunidad',
    question: '¿Cuándo se realizan los talleres artísticos y encuentros de familias?',
    answer:
      'Los talleres de SON UP, lectura compartida y escuela de familias se publican semanalmente en la categoría Avisos del foro. Todas las familias registradas en AsisConexión pueden participar sin costo.',
  },
  {
    category: 'Inscripciones',
    question: '¿Cómo inscribo a un beneficiario en los programas de la Fundación Asisco?',
    answer:
      'Debes diligenciar la solicitud inicial con los datos del acudiente y del beneficiario, adjuntar documento de identidad y aceptar expresamente la autorización de tratamiento de datos personales conforme a la Ley 1581 de 2012.',
  },
  {
    category: 'Inscripciones',
    question: '¿Tiene algún costo registrarse en AsisConexión?',
    answer:
      'No. El acceso a AsisConexión, sus foros comunitarios y la orientación inicial para familias y beneficiarios es completamente gratuito.',
  },
  {
    category: 'Programas',
    question: '¿Qué diferencia existe entre SUMA 21, AULA UP y SAGA-UP?',
    answer:
      'SUMA 21 articula procesos de inclusión social y formación integral; AULA UP ofrece acompañamiento pedagógico virtual; y SAGA-UP gestiona el seguimiento académico e institucional de los participantes.',
  },
  {
    category: 'Voluntariado',
    question: '¿Cómo puedo postularme como voluntario o aliado en la Fundación Asisco?',
    answer:
      'Regístrate en AsisConexión seleccionando el rol VOLUNTARIO o INVERSOR y utiliza el botón de atención humana por WhatsApp para coordinar tu vinculación con el equipo coordinador.',
  },
];

export async function seedFaqKnowledge(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(FaqKnowledge);

  for (const item of DEFAULT_FAQS) {
    const existing = await repo.findOne({
      where: { question: item.question },
      select: { id: true },
    });

    if (!existing) {
      const entity = repo.create({
        question: item.question,
        answer: item.answer,
        category: item.category,
      });
      await repo.save(entity);
    }
  }
}
