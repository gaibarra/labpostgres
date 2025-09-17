const { z } = require('zod');

const email = z.string().email();
const uuid = z.string().uuid();

// Auth
const registerSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(6),
    full_name: z.string().min(1).optional().nullable(),
    role: z.string().optional()
  })
});

const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1)
  })
});

// Patients
const createPatientSchema = z.object({
  body: z.object({
    full_name: z.string().min(1),
    date_of_birth: z.string().date().optional().nullable().or(z.string().length(0)).optional(),
    sex: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contact_name: z.string().optional().nullable(),
    contact_phone: z.string().optional().nullable(),
    clinical_history: z.string().optional().nullable()
  })
});

const updatePatientSchema = z.object({
  body: createPatientSchema.shape.body.partial(),
  params: z.object({ id: uuid })
});

// Work Orders
const createWorkOrderSchema = z.object({
  body: z.object({
    folio: z.string().optional().nullable(),
    patient_id: uuid.optional().nullable(),
    referring_entity_id: uuid.optional().nullable(),
    referring_doctor_id: uuid.optional().nullable(),
  order_date: z.string().datetime().optional().nullable(),
    status: z.string().optional().nullable(),
    selected_items: z.any().optional().nullable(),
  subtotal: z.number().nonnegative().optional().nullable(),
  descuento: z.number().nonnegative().optional().nullable(),
  anticipo: z.number().nonnegative().optional().nullable(),
  total_price: z.number().nonnegative().optional().nullable(),
  notas: z.string().optional().nullable(),
  results: z.any().optional().nullable(),
  validation_notes: z.string().optional().nullable()
  })
});

const updateWorkOrderSchema = z.object({
  body: createWorkOrderSchema.shape.body.partial().extend({
    results_finalized: z.boolean().optional(),
    receipt_generated: z.boolean().optional()
  }),
  params: z.object({ id: uuid })
});

module.exports = {
  registerSchema,
  loginSchema,
  createPatientSchema,
  updatePatientSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  // extended schemas added below
};

// --- Extended domain schemas (analysis, referrers, packages) ---
const analysisCreateSchema = z.object({
  body: z.object({
    clave: z.string().optional().nullable(),
    name: z.string().min(3),
    category: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    indications: z.string().optional().nullable(),
    sample_type: z.string().optional().nullable(),
    sample_container: z.string().optional().nullable(),
    processing_time_hours: z.number().int().min(0).optional().nullable(),
    general_units: z.string().optional().nullable(),
    price: z.number().nonnegative().optional().nullable()
  })
});

const analysisUpdateSchema = z.object({
  params: z.object({ id: uuid }),
  body: analysisCreateSchema.shape.body.partial()
});

const referrerCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    entity_type: z.string().optional().nullable(),
    specialty: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone_number: z.string().min(7).max(20).optional().nullable(),
    address: z.string().optional().nullable(),
    listaprecios: z.any().optional().nullable()
  })
});
const referrerUpdateSchema = z.object({ params: z.object({ id: uuid }), body: referrerCreateSchema.shape.body.partial() });

const packageCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().optional().nullable(),
    price: z.number().nonnegative().optional().nullable()
  })
});
const packageUpdateSchema = z.object({ params: z.object({ id: uuid }), body: packageCreateSchema.shape.body.partial() });

module.exports.analysisCreateSchema = analysisCreateSchema;
module.exports.analysisUpdateSchema = analysisUpdateSchema;
module.exports.referrerCreateSchema = referrerCreateSchema;
module.exports.referrerUpdateSchema = referrerUpdateSchema;
module.exports.packageCreateSchema = packageCreateSchema;
module.exports.packageUpdateSchema = packageUpdateSchema;

