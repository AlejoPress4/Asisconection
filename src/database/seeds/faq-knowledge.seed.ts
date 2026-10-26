import type { DataSource } from 'typeorm';
import { FaqKnowledge } from '../../modules/assistant/entities/faq-knowledge.entity';

interface FaqSeedItem {
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

const DEFAULT_FAQS: ReadonlyArray<FaqSeedItem> = [
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
    category: 'Programas',
    question: '¿Por qué mi publicación o comentario no aparece inmediatamente en el foro?',
    answer:
      'Para proteger a niños, niñas, adolescentes y familias (Ley 1098 de 2006 y regla RN-02), toda publicación y comentario pasa por moderación humana del equipo administrador antes de hacerse visible.',
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
