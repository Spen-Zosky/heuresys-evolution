/**
 * Config Routes
 * Dynamic configuration endpoints for statuses, roles, and labels.
 * Replaces hardcoded frontend mapping objects with DB-driven data.
 */
import { Router } from 'express';
import { asyncHandler } from '../errors/middleware.js';
const router = Router();
/**
 * GET /config/statuses
 * Returns status configurations for all entity types.
 * Query: ?entity=goals (optional, filter by entity type)
 *
 * Each status includes: code, label (IT), color class, and sort order.
 * Source of truth: CHECK constraints on status columns + this endpoint.
 */
router.get('/statuses', asyncHandler(async (req, res) => {
    const entity = req.query.entity;
    const statuses = {
        goals: [
            {
                code: 'draft',
                label: 'Bozza',
                className: 'bg-gray-500 hover:bg-gray-500/80 text-white',
                order: 0,
            },
            {
                code: 'active',
                label: 'Attivo',
                className: 'bg-green-500 hover:bg-green-500/80 text-white',
                order: 1,
            },
            {
                code: 'completed',
                label: 'Completato',
                className: 'bg-blue-500 hover:bg-blue-500/80 text-white',
                order: 2,
            },
            {
                code: 'on_hold',
                label: 'In pausa',
                className: 'bg-yellow-500 hover:bg-yellow-500/80 text-white',
                order: 3,
            },
            {
                code: 'cancelled',
                label: 'Annullato',
                className: 'bg-red-500 hover:bg-red-500/80 text-white',
                order: 4,
            },
        ],
        reviews: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            {
                code: 'in_progress',
                label: 'In corso',
                className: 'bg-blue-100 text-blue-800',
                order: 1,
            },
            {
                code: 'pending_review',
                label: 'In revisione',
                className: 'bg-yellow-100 text-yellow-800',
                order: 2,
            },
            {
                code: 'completed',
                label: 'Completata',
                className: 'bg-green-100 text-green-800',
                order: 3,
            },
            { code: 'cancelled', label: 'Annullata', className: 'bg-red-100 text-red-800', order: 4 },
            {
                code: 'acknowledged',
                label: 'Presa visione',
                className: 'bg-purple-100 text-purple-800',
                order: 5,
            },
        ],
        review_cycles: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            { code: 'active', label: 'Attivo', className: 'bg-green-100 text-green-800', order: 1 },
            {
                code: 'in_progress',
                label: 'In corso',
                className: 'bg-blue-100 text-blue-800',
                order: 2,
            },
            {
                code: 'completed',
                label: 'Completato',
                className: 'bg-purple-100 text-purple-800',
                order: 3,
            },
        ],
        enrollments: [
            { code: 'enrolled', label: 'Iscritto', className: 'bg-blue-100 text-blue-800', order: 0 },
            {
                code: 'in_progress',
                label: 'In corso',
                className: 'bg-yellow-100 text-yellow-800',
                order: 1,
            },
            {
                code: 'completed',
                label: 'Completato',
                className: 'bg-green-100 text-green-800',
                order: 2,
            },
            { code: 'dropped', label: 'Ritirato', className: 'bg-red-100 text-red-800', order: 3 },
            { code: 'failed', label: 'Non superato', className: 'bg-red-100 text-red-800', order: 4 },
        ],
        okrs: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            { code: 'active', label: 'Attivo', className: 'bg-green-100 text-green-800', order: 1 },
            {
                code: 'completed',
                label: 'Completato',
                className: 'bg-blue-100 text-blue-800',
                order: 2,
            },
            { code: 'cancelled', label: 'Annullato', className: 'bg-red-100 text-red-800', order: 3 },
        ],
        calibration: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            {
                code: 'in_progress',
                label: 'In corso',
                className: 'bg-blue-100 text-blue-800',
                order: 1,
            },
            {
                code: 'completed',
                label: 'Completata',
                className: 'bg-green-100 text-green-800',
                order: 2,
            },
            { code: 'cancelled', label: 'Annullata', className: 'bg-red-100 text-red-800', order: 3 },
        ],
        employees: [
            { code: 'active', label: 'Attivo', className: 'bg-green-100 text-green-800', order: 0 },
            { code: 'inactive', label: 'Inattivo', className: 'bg-gray-100 text-gray-800', order: 1 },
            {
                code: 'on_leave',
                label: 'In congedo',
                className: 'bg-yellow-100 text-yellow-800',
                order: 2,
            },
            { code: 'terminated', label: 'Cessato', className: 'bg-red-100 text-red-800', order: 3 },
        ],
        requisitions: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            { code: 'open', label: 'Aperta', className: 'bg-green-100 text-green-800', order: 1 },
            {
                code: 'in_progress',
                label: 'In corso',
                className: 'bg-blue-100 text-blue-800',
                order: 2,
            },
            { code: 'closed', label: 'Chiusa', className: 'bg-purple-100 text-purple-800', order: 3 },
        ],
        postings: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            { code: 'active', label: 'Attiva', className: 'bg-green-100 text-green-800', order: 1 },
            { code: 'paused', label: 'In pausa', className: 'bg-yellow-100 text-yellow-800', order: 2 },
            { code: 'closed', label: 'Chiusa', className: 'bg-red-100 text-red-800', order: 3 },
        ],
        mobility: [
            {
                code: 'pending',
                label: 'In attesa',
                className: 'bg-yellow-100 text-yellow-800',
                order: 0,
            },
            {
                code: 'approved',
                label: 'Approvato',
                className: 'bg-green-100 text-green-800',
                order: 1,
            },
            {
                code: 'completed',
                label: 'Completato',
                className: 'bg-blue-100 text-blue-800',
                order: 2,
            },
            { code: 'rejected', label: 'Rifiutato', className: 'bg-red-100 text-red-800', order: 3 },
        ],
        documents: [
            { code: 'draft', label: 'Bozza', className: 'bg-gray-100 text-gray-800', order: 0 },
            { code: 'active', label: 'Attivo', className: 'bg-green-100 text-green-800', order: 1 },
            {
                code: 'archived',
                label: 'Archiviato',
                className: 'bg-yellow-100 text-yellow-800',
                order: 2,
            },
            { code: 'expired', label: 'Scaduto', className: 'bg-red-100 text-red-800', order: 3 },
        ],
        attendance: [
            { code: 'present', label: 'Presente', className: 'bg-green-100 text-green-800', order: 0 },
            { code: 'absent', label: 'Assente', className: 'bg-red-100 text-red-800', order: 1 },
            { code: 'late', label: 'In ritardo', className: 'bg-yellow-100 text-yellow-800', order: 2 },
            { code: 'remote', label: 'Da remoto', className: 'bg-blue-100 text-blue-800', order: 3 },
            {
                code: 'holiday',
                label: 'Festivita',
                className: 'bg-purple-100 text-purple-800',
                order: 4,
            },
            { code: 'sick', label: 'Malattia', className: 'bg-orange-100 text-orange-800', order: 5 },
        ],
        platform_pages: [
            {
                code: 'active',
                label: 'Attiva',
                className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                order: 0,
            },
            {
                code: 'redirect',
                label: 'Redirect',
                className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                order: 1,
            },
            {
                code: 'legacy',
                label: 'Superata',
                className: 'bg-red-500/10 text-red-500 border-red-500/20',
                order: 2,
            },
            {
                code: 'experimental',
                label: 'Sperimentale',
                className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                order: 3,
            },
        ],
    };
    if (entity) {
        const entityStatuses = statuses[entity];
        if (!entityStatuses) {
            res.json({ success: true, data: {} });
            return;
        }
        res.json({ success: true, data: { [entity]: entityStatuses } });
        return;
    }
    res.json({ success: true, data: statuses });
}));
/**
 * GET /config/roles
 * Returns role hierarchy with levels and permissions.
 */
router.get('/roles', asyncHandler(async (_req, res) => {
    const roles = [
        { code: 'SUPERUSER', level: -1, label: 'Super Amministratore', color: 'destructive' },
        { code: 'TENANT_OWNER', level: 0, label: 'Amministratore Sistema', color: 'destructive' },
        { code: 'ADMIN', level: 0, label: 'Amministratore', color: 'default' },
        { code: 'DEMO', level: 2, label: 'Demo', color: 'outline' },
        { code: 'HR', level: 3, label: 'Risorse Umane', color: 'default' },
        { code: 'MANAGER', level: 4, label: 'Manager', color: 'secondary' },
        { code: 'USER', level: 5, label: 'Utente', color: 'outline' },
        { code: 'EMPLOYEE', level: 5, label: 'Dipendente', color: 'outline' },
    ];
    res.json({ success: true, data: roles });
}));
/**
 * GET /config/labels
 * Returns localized labels for entity types and categories.
 * Query: ?entity=goal_types (optional)
 */
router.get('/labels', asyncHandler(async (req, res) => {
    const entity = req.query.entity;
    const labels = {
        goal_types: {
            individual: 'Individuale',
            team: 'Team',
            department: 'Dipartimento',
            company: 'Aziendale',
        },
        contract_types: {
            full_time: 'Tempo pieno',
            part_time: 'Part-time',
            internship: 'Stage',
            contractor: 'Collaboratore',
            temporary: 'Tempo determinato',
            apprenticeship: 'Apprendistato',
        },
        skill_levels: {
            beginner: 'Base',
            intermediate: 'Intermedio',
            advanced: 'Avanzato',
            expert: 'Esperto',
        },
        mobility_types: {
            promotion: 'Promozione',
            lateral: 'Laterale',
            demotion: 'Retrocessione',
            transfer: 'Trasferimento',
        },
    };
    if (entity) {
        const entityLabels = labels[entity];
        if (!entityLabels) {
            res.json({ success: true, data: {} });
            return;
        }
        res.json({ success: true, data: { [entity]: entityLabels } });
        return;
    }
    res.json({ success: true, data: labels });
}));
export default router;
//# sourceMappingURL=config.js.map