/**
 * Heuresys Database Error Handler
 *
 * Gestisce e trasforma gli errori PostgreSQL in HeuresysError strutturati.
 * Mappa i codici di errore PostgreSQL a messaggi user-friendly e HTTP status appropriati.
 */
import { ErrorCodes } from './types.js';
import { createHeuresysError } from './factory.js';
/**
 * Mapping completo dei codici SQLSTATE PostgreSQL
 * Ref: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PostgresErrorMapping = {
    // Class 00 - Successful Completion
    '00000': { heuresysCode: ErrorCodes.DB.QUERY_SUCCESS, httpStatus: 200, messagePrefix: 'Operazione completata', category: 'data' },
    // Class 02 - No Data
    '02000': { heuresysCode: ErrorCodes.API.NOT_FOUND, httpStatus: 404, messagePrefix: 'Nessun dato trovato', category: 'data' },
    '02001': { heuresysCode: ErrorCodes.API.NOT_FOUND, httpStatus: 404, messagePrefix: 'Nessun dato aggiuntivo', category: 'data' },
    // Class 08 - Connection Exception
    '08000': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Errore di connessione al database', category: 'connection' },
    '08003': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Connessione inesistente', category: 'connection' },
    '08006': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Connessione persa', category: 'connection' },
    '08001': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Impossibile stabilire connessione', category: 'connection' },
    '08004': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Connessione rifiutata dal server', category: 'connection' },
    '08007': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Risoluzione transazione sconosciuta', category: 'transaction' },
    '08P01': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Violazione protocollo', category: 'connection' },
    // Class 09 - Triggered Action Exception
    '09000': { heuresysCode: ErrorCodes.DB.TRIGGER_ERROR, httpStatus: 500, messagePrefix: 'Errore trigger', category: 'system' },
    // Class 0A - Feature Not Supported
    '0A000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 501, messagePrefix: 'Funzionalità non supportata', category: 'syntax' },
    // Class 0B - Invalid Transaction Initiation
    '0B000': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Inizializzazione transazione non valida', category: 'transaction' },
    // Class 0F - Locator Exception
    '0F000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Eccezione locator', category: 'data' },
    '0F001': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Locator non valido', category: 'data' },
    // Class 0L - Invalid Grantor
    '0L000': { heuresysCode: ErrorCodes.PERMISSION.ACCESS_DENIED, httpStatus: 403, messagePrefix: 'Grantor non valido', category: 'access' },
    // Class 0P - Invalid Role Specification
    '0P000': { heuresysCode: ErrorCodes.PERMISSION.ACCESS_DENIED, httpStatus: 403, messagePrefix: 'Ruolo non valido', category: 'access' },
    // Class 20 - Case Not Found
    '20000': { heuresysCode: ErrorCodes.API.NOT_FOUND, httpStatus: 404, messagePrefix: 'Case non trovato', category: 'data' },
    // Class 21 - Cardinality Violation
    '21000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Violazione cardinalità', category: 'data' },
    // Class 22 - Data Exception
    '22000': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Errore dati', category: 'data' },
    '22001': { heuresysCode: ErrorCodes.VALIDATION.VALUE_TOO_LONG, httpStatus: 400, messagePrefix: 'Stringa troppo lunga', category: 'data' },
    '22002': { heuresysCode: ErrorCodes.VALIDATION.NULL_VIOLATION, httpStatus: 400, messagePrefix: 'Valore null non permesso', category: 'data' },
    '22003': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Valore numerico fuori range', category: 'data' },
    '22004': { heuresysCode: ErrorCodes.VALIDATION.NULL_VIOLATION, httpStatus: 400, messagePrefix: 'Valore null non permesso', category: 'data' },
    '22005': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Errore nell\'assegnazione', category: 'data' },
    '22007': { heuresysCode: ErrorCodes.VALIDATION.INVALID_DATE, httpStatus: 400, messagePrefix: 'Formato data/ora non valido', category: 'data' },
    '22008': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Overflow campo data/ora', category: 'data' },
    '22009': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Fuso orario non valido', category: 'data' },
    '2200B': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Sequenza di escape non valida', category: 'data' },
    '2200C': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Uso carattere escape non valido', category: 'data' },
    '2200D': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Carattere escape non valido', category: 'data' },
    '2200F': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Carattere escape null', category: 'data' },
    '22010': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Uso indicatore non valido', category: 'data' },
    '22011': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Errore substring', category: 'data' },
    '22012': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Divisione per zero', category: 'data' },
    '22015': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Overflow campo intervallo', category: 'data' },
    '22018': { heuresysCode: ErrorCodes.VALIDATION.TYPE_MISMATCH, httpStatus: 400, messagePrefix: 'Carattere non valido per cast', category: 'data' },
    '22019': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Carattere escape non valido', category: 'data' },
    '2201B': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Argomento regex non valido', category: 'data' },
    '2201E': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Argomento logaritmo non valido', category: 'data' },
    '2201F': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Argomento potenza non valido', category: 'data' },
    '2201G': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Argomento larghezza bucket non valido', category: 'data' },
    '22020': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Valore limite non valido', category: 'data' },
    '22021': { heuresysCode: ErrorCodes.VALIDATION.INVALID_ENCODING, httpStatus: 400, messagePrefix: 'Byte non valido per set caratteri', category: 'data' },
    '22022': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Indicatore non valido', category: 'data' },
    '22023': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Valore parametro non valido', category: 'data' },
    '22024': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Stringa C non terminata', category: 'data' },
    '22025': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Sequenza escape non valida', category: 'data' },
    '22026': { heuresysCode: ErrorCodes.VALIDATION.VALUE_TOO_LONG, httpStatus: 400, messagePrefix: 'Lunghezza dati stringa non corrisponde', category: 'data' },
    '22027': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Marcatore trim non valido', category: 'data' },
    '2202E': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Subscript array nullo', category: 'data' },
    '2202G': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Argomento tablesample nullo', category: 'data' },
    '2202H': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Argomento tablesample non valido', category: 'data' },
    '22P01': { heuresysCode: ErrorCodes.VALIDATION.VALUE_OUT_OF_RANGE, httpStatus: 400, messagePrefix: 'Punto codepoint unicode surrogato non permesso', category: 'data' },
    '22P02': { heuresysCode: ErrorCodes.VALIDATION.TYPE_MISMATCH, httpStatus: 400, messagePrefix: 'Sintassi testo non valida', category: 'data' },
    '22P03': { heuresysCode: ErrorCodes.VALIDATION.TYPE_MISMATCH, httpStatus: 400, messagePrefix: 'Sintassi binaria non valida', category: 'data' },
    '22P04': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Argomento copy file non valido', category: 'data' },
    '22P05': { heuresysCode: ErrorCodes.VALIDATION.INVALID_ENCODING, httpStatus: 400, messagePrefix: 'Sequenza encoding non traducibile', category: 'data' },
    '22P06': { heuresysCode: ErrorCodes.VALIDATION.INVALID_FORMAT, httpStatus: 400, messagePrefix: 'Formato non standard', category: 'data' },
    // Class 23 - Integrity Constraint Violation
    '23000': { heuresysCode: ErrorCodes.DB.CONSTRAINT_VIOLATION, httpStatus: 409, messagePrefix: 'Violazione vincolo di integrità', category: 'constraint' },
    '23001': { heuresysCode: ErrorCodes.DB.CONSTRAINT_VIOLATION, httpStatus: 409, messagePrefix: 'Violazione restrizione', category: 'constraint' },
    '23502': { heuresysCode: ErrorCodes.DB.NULL_VIOLATION, httpStatus: 400, messagePrefix: 'Violazione vincolo NOT NULL', category: 'constraint' },
    '23503': { heuresysCode: ErrorCodes.DB.FOREIGN_KEY_VIOLATION, httpStatus: 409, messagePrefix: 'Violazione foreign key', category: 'constraint' },
    '23505': { heuresysCode: ErrorCodes.DB.UNIQUE_VIOLATION, httpStatus: 409, messagePrefix: 'Violazione vincolo UNIQUE', category: 'constraint' },
    '23514': { heuresysCode: ErrorCodes.DB.CHECK_VIOLATION, httpStatus: 400, messagePrefix: 'Violazione vincolo CHECK', category: 'constraint' },
    '23P01': { heuresysCode: ErrorCodes.DB.EXCLUSION_VIOLATION, httpStatus: 409, messagePrefix: 'Violazione vincolo EXCLUSION', category: 'constraint' },
    // Class 24 - Invalid Cursor State
    '24000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Stato cursore non valido', category: 'data' },
    // Class 25 - Invalid Transaction State
    '25000': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Stato transazione non valido', category: 'transaction' },
    '25001': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Transazione attiva', category: 'transaction' },
    '25002': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Branch transazione attivo', category: 'transaction' },
    '25008': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Transazione held cursors', category: 'transaction' },
    '25003': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Controllo accesso non appropriato per branch transazione', category: 'transaction' },
    '25004': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Operazione schema non appropriata per branch transazione', category: 'transaction' },
    '25005': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Transazione non nel branch', category: 'transaction' },
    '25006': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 409, messagePrefix: 'Transazione read-only', category: 'transaction' },
    '25007': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Schema/dati non consentiti', category: 'transaction' },
    '25P01': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Nessuna transazione attiva', category: 'transaction' },
    '25P02': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Transazione abortita', category: 'transaction' },
    '25P03': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Idle in transazione timeout sessione', category: 'transaction' },
    // Class 26 - Invalid SQL Statement Name
    '26000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Nome statement SQL non valido', category: 'syntax' },
    // Class 27 - Triggered Data Change Violation
    '27000': { heuresysCode: ErrorCodes.DB.TRIGGER_ERROR, httpStatus: 500, messagePrefix: 'Violazione cambio dati trigger', category: 'system' },
    // Class 28 - Invalid Authorization Specification
    '28000': { heuresysCode: ErrorCodes.AUTH.INVALID_CREDENTIALS, httpStatus: 401, messagePrefix: 'Specifica autorizzazione non valida', category: 'access' },
    '28P01': { heuresysCode: ErrorCodes.AUTH.INVALID_CREDENTIALS, httpStatus: 401, messagePrefix: 'Autenticazione password fallita', category: 'access' },
    // Class 2B - Dependent Privilege Descriptors Still Exist
    '2B000': { heuresysCode: ErrorCodes.DB.CONSTRAINT_VIOLATION, httpStatus: 409, messagePrefix: 'Descrittori privilegi dipendenti esistenti', category: 'constraint' },
    '2BP01': { heuresysCode: ErrorCodes.DB.CONSTRAINT_VIOLATION, httpStatus: 409, messagePrefix: 'Oggetti dipendenti esistenti', category: 'constraint' },
    // Class 2D - Invalid Transaction Termination
    '2D000': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Terminazione transazione non valida', category: 'transaction' },
    // Class 2F - SQL Routine Exception
    '2F000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Eccezione routine SQL', category: 'system' },
    '2F005': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Funzione non ritorna statement', category: 'system' },
    '2F002': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Modifica dati SQL non permessa', category: 'system' },
    '2F003': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Statement SQL proibito', category: 'system' },
    '2F004': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Lettura dati SQL non permessa', category: 'system' },
    // Class 34 - Invalid Cursor Name
    '34000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Nome cursore non valido', category: 'syntax' },
    // Class 38 - External Routine Exception
    '38000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Eccezione routine esterna', category: 'system' },
    '38001': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Contenente statement SQL non permesso', category: 'system' },
    '38002': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Modifica dati SQL non permessa', category: 'system' },
    '38003': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Statement SQL proibito', category: 'system' },
    '38004': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Lettura dati SQL non permessa', category: 'system' },
    // Class 39 - External Routine Invocation Exception
    '39000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Eccezione invocazione routine esterna', category: 'system' },
    '39001': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Gestione valore restituito non valida', category: 'system' },
    '39004': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Valore null non permesso', category: 'system' },
    '39P01': { heuresysCode: ErrorCodes.DB.TRIGGER_ERROR, httpStatus: 500, messagePrefix: 'Protocollo trigger non valido', category: 'system' },
    '39P02': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Protocollo SRF non valido', category: 'system' },
    '39P03': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Sostituzione risultato evento non permessa', category: 'system' },
    // Class 3B - Savepoint Exception
    '3B000': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Eccezione savepoint', category: 'transaction' },
    '3B001': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Specifica savepoint non valida', category: 'transaction' },
    // Class 3D - Invalid Catalog Name
    '3D000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Nome catalogo non valido', category: 'syntax' },
    // Class 3F - Invalid Schema Name
    '3F000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Nome schema non valido', category: 'syntax' },
    // Class 40 - Transaction Rollback
    '40000': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 409, messagePrefix: 'Rollback transazione', category: 'transaction' },
    '40002': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 409, messagePrefix: 'Violazione vincolo integrità transazione', category: 'transaction' },
    '40001': { heuresysCode: ErrorCodes.DB.SERIALIZATION_FAILURE, httpStatus: 409, messagePrefix: 'Fallimento serializzazione', category: 'transaction' },
    '40003': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Completamento statement sconosciuto', category: 'transaction' },
    '40P01': { heuresysCode: ErrorCodes.DB.DEADLOCK, httpStatus: 409, messagePrefix: 'Deadlock rilevato', category: 'transaction' },
    // Class 42 - Syntax Error or Access Rule Violation
    '42000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Errore sintassi o violazione regola accesso', category: 'syntax' },
    '42601': { heuresysCode: ErrorCodes.DB.SYNTAX_ERROR, httpStatus: 400, messagePrefix: 'Errore sintassi', category: 'syntax' },
    '42501': { heuresysCode: ErrorCodes.PERMISSION.ACCESS_DENIED, httpStatus: 403, messagePrefix: 'Privilegio insufficiente', category: 'access' },
    '42846': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Cast non valido', category: 'syntax' },
    '42803': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Errore raggruppamento', category: 'syntax' },
    '42P20': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Clausola windowing non valida', category: 'syntax' },
    '42P19': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Ricorsione non valida', category: 'syntax' },
    '42830': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Foreign key non valida', category: 'syntax' },
    '42602': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Nome non valido', category: 'syntax' },
    '42622': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Nome troppo lungo', category: 'syntax' },
    '42939': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Nome riservato', category: 'syntax' },
    '42804': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Tipo di dato errato', category: 'syntax' },
    '42P18': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Tipo di dato indeterminato', category: 'syntax' },
    '42P21': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Collation non supportata', category: 'syntax' },
    '42P22': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Collation indeterminata', category: 'syntax' },
    '42809': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Tipo oggetto errato', category: 'syntax' },
    '428C9': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Colonne generate non possono essere aggiornate', category: 'syntax' },
    '42703': { heuresysCode: ErrorCodes.DB.UNDEFINED_COLUMN, httpStatus: 400, messagePrefix: 'Colonna non definita', category: 'syntax' },
    '42883': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Funzione non definita', category: 'syntax' },
    '42P01': { heuresysCode: ErrorCodes.DB.UNDEFINED_TABLE, httpStatus: 400, messagePrefix: 'Tabella non definita', category: 'syntax' },
    '42P02': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Parametro non definito', category: 'syntax' },
    '42704': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Oggetto non definito', category: 'syntax' },
    '42701': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Colonna duplicata', category: 'syntax' },
    '42P03': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Cursore duplicato', category: 'syntax' },
    '42P04': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Database duplicato', category: 'syntax' },
    '42723': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Funzione duplicata', category: 'syntax' },
    '42P05': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Statement preparato duplicato', category: 'syntax' },
    '42P06': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Schema duplicato', category: 'syntax' },
    '42P07': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 409, messagePrefix: 'Tabella duplicata', category: 'syntax' },
    '42712': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Alias duplicato', category: 'syntax' },
    '42710': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 409, messagePrefix: 'Oggetto duplicato', category: 'syntax' },
    '42702': { heuresysCode: ErrorCodes.DB.AMBIGUOUS_COLUMN, httpStatus: 400, messagePrefix: 'Riferimento colonna ambiguo', category: 'syntax' },
    '42725': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Riferimento funzione ambiguo', category: 'syntax' },
    '42P08': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Tipo parametro ambiguo', category: 'syntax' },
    '42P09': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Alias ambiguo', category: 'syntax' },
    '42P10': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Specifica colonna non valida', category: 'syntax' },
    '42611': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione colonna non valida', category: 'syntax' },
    '42P11': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione cursore non valida', category: 'syntax' },
    '42P12': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione database non valida', category: 'syntax' },
    '42P13': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione funzione non valida', category: 'syntax' },
    '42P14': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione statement preparato non valida', category: 'syntax' },
    '42P15': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione schema non valida', category: 'syntax' },
    '42P16': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione tabella non valida', category: 'syntax' },
    '42P17': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Definizione oggetto non valida', category: 'syntax' },
    // Class 44 - WITH CHECK OPTION Violation
    '44000': { heuresysCode: ErrorCodes.DB.CHECK_VIOLATION, httpStatus: 400, messagePrefix: 'Violazione opzione WITH CHECK', category: 'constraint' },
    // Class 53 - Insufficient Resources
    '53000': { heuresysCode: ErrorCodes.DB.INSUFFICIENT_RESOURCES, httpStatus: 503, messagePrefix: 'Risorse insufficienti', category: 'system' },
    '53100': { heuresysCode: ErrorCodes.DB.DISK_FULL, httpStatus: 503, messagePrefix: 'Disco pieno', category: 'system' },
    '53200': { heuresysCode: ErrorCodes.DB.MEMORY_ERROR, httpStatus: 503, messagePrefix: 'Memoria esaurita', category: 'system' },
    '53300': { heuresysCode: ErrorCodes.DB.CONNECTION_LIMIT, httpStatus: 503, messagePrefix: 'Troppe connessioni', category: 'system' },
    '53400': { heuresysCode: ErrorCodes.DB.INSUFFICIENT_RESOURCES, httpStatus: 503, messagePrefix: 'Limite configurazione superato', category: 'system' },
    // Class 54 - Program Limit Exceeded
    '54000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Limite programma superato', category: 'system' },
    '54001': { heuresysCode: ErrorCodes.DB.QUERY_TOO_COMPLEX, httpStatus: 400, messagePrefix: 'Statement troppo complesso', category: 'system' },
    '54011': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Troppe colonne', category: 'system' },
    '54023': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 400, messagePrefix: 'Troppi argomenti', category: 'system' },
    // Class 55 - Object Not In Prerequisite State
    '55000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Oggetto non nello stato prerequisito', category: 'system' },
    '55006': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Oggetto in uso', category: 'system' },
    '55P02': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Parametro non può essere cambiato ora', category: 'system' },
    '55P03': { heuresysCode: ErrorCodes.DB.LOCK_NOT_AVAILABLE, httpStatus: 503, messagePrefix: 'Lock non disponibile', category: 'system' },
    '55P04': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Oggetto unsafe per questa connessione', category: 'system' },
    // Class 57 - Operator Intervention
    '57000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Intervento operatore', category: 'system' },
    '57014': { heuresysCode: ErrorCodes.DB.QUERY_TIMEOUT, httpStatus: 504, messagePrefix: 'Query cancellata', category: 'system' },
    '57P01': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Server in arresto', category: 'connection' },
    '57P02': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Crash arresto', category: 'connection' },
    '57P03': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Connessione non accettata', category: 'connection' },
    '57P04': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Recovery database in corso', category: 'connection' },
    '57P05': { heuresysCode: ErrorCodes.DB.CONNECTION_ERROR, httpStatus: 503, messagePrefix: 'Shutdown database in corso', category: 'connection' },
    // Class 58 - System Error
    '58000': { heuresysCode: ErrorCodes.DB.SYSTEM_ERROR, httpStatus: 500, messagePrefix: 'Errore di sistema', category: 'system' },
    '58030': { heuresysCode: ErrorCodes.DB.IO_ERROR, httpStatus: 500, messagePrefix: 'Errore I/O', category: 'system' },
    '58P01': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'File undefined', category: 'system' },
    '58P02': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'File duplicato', category: 'system' },
    // Class 72 - Snapshot Failure
    '72000': { heuresysCode: ErrorCodes.DB.TRANSACTION_ERROR, httpStatus: 500, messagePrefix: 'Fallimento snapshot', category: 'transaction' },
    // Class F0 - Configuration File Error
    'F0000': { heuresysCode: ErrorCodes.SYSTEM.CONFIGURATION_ERROR, httpStatus: 500, messagePrefix: 'Errore file configurazione', category: 'system' },
    'F0001': { heuresysCode: ErrorCodes.DB.LOCK_NOT_AVAILABLE, httpStatus: 500, messagePrefix: 'File lock non acquisito', category: 'system' },
    // Class HV - Foreign Data Wrapper Error (SQL/MED)
    'HV000': { heuresysCode: ErrorCodes.INTEGRATION.EXTERNAL_SERVICE_ERROR, httpStatus: 502, messagePrefix: 'Errore FDW', category: 'system' },
    // Class P0 - PL/pgSQL Error
    'P0000': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Errore PL/pgSQL', category: 'system' },
    'P0001': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Raise exception', category: 'system' },
    'P0002': { heuresysCode: ErrorCodes.API.NOT_FOUND, httpStatus: 404, messagePrefix: 'Nessun dato trovato', category: 'data' },
    'P0003': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Troppe righe', category: 'data' },
    'P0004': { heuresysCode: ErrorCodes.DB.QUERY_ERROR, httpStatus: 500, messagePrefix: 'Asserzione fallita', category: 'system' },
    // Class XX - Internal Error
    'XX000': { heuresysCode: ErrorCodes.DB.SYSTEM_ERROR, httpStatus: 500, messagePrefix: 'Errore interno', category: 'system' },
    'XX001': { heuresysCode: ErrorCodes.DB.SYSTEM_ERROR, httpStatus: 500, messagePrefix: 'Corruzione dati', category: 'system' },
    'XX002': { heuresysCode: ErrorCodes.DB.SYSTEM_ERROR, httpStatus: 500, messagePrefix: 'Corruzione indice', category: 'system' },
};
/**
 * Estrae informazioni contestuali da un errore PostgreSQL
 */
export function extractDatabaseContext(error) {
    return {
        query: error.internalQuery,
        table: error.table,
        column: error.column,
        constraint: error.constraint,
        schema: error.schema,
        errorCode: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position ? parseInt(error.position) : undefined
    };
}
/**
 * Estrae il nome della tabella/colonna dal messaggio di errore se non fornito
 */
function extractFromMessage(message) {
    const result = {};
    // Pattern per estrarre tabella: "relation \"tablename\""
    const tableMatch = message.match(/relation "([^"]+)"/i);
    if (tableMatch && tableMatch[1])
        result.table = tableMatch[1];
    // Pattern per estrarre colonna: "column \"columnname\""
    const columnMatch = message.match(/column "([^"]+)"/i);
    if (columnMatch && columnMatch[1])
        result.column = columnMatch[1];
    // Pattern per estrarre constraint: "constraint \"constraintname\""
    const constraintMatch = message.match(/constraint "([^"]+)"/i);
    if (constraintMatch && constraintMatch[1])
        result.constraint = constraintMatch[1];
    return result;
}
/**
 * Genera un messaggio user-friendly per vincoli specifici
 */
function getConstraintMessage(constraint, table, column) {
    // Pattern comuni di naming dei constraint
    if (constraint.includes('_pkey')) {
        return `Chiave primaria duplicata${table ? ` nella tabella '${table}'` : ''}`;
    }
    if (constraint.includes('_unique') || constraint.includes('_key')) {
        return `Valore duplicato${column ? ` per il campo '${column}'` : ''}${table ? ` nella tabella '${table}'` : ''}`;
    }
    if (constraint.includes('_fkey') || constraint.includes('_fk_')) {
        return `Riferimento non valido${table ? ` nella tabella '${table}'` : ''} - il record collegato non esiste o non può essere rimosso`;
    }
    if (constraint.includes('_check') || constraint.includes('_ck_')) {
        return `Valore non valido${column ? ` per il campo '${column}'` : ''} - non rispetta le regole di validazione`;
    }
    if (constraint.includes('_nn') || constraint.includes('_not_null')) {
        return `Il campo${column ? ` '${column}'` : ''} è obbligatorio`;
    }
    return `Violazione vincolo '${constraint}'`;
}
/**
 * Mapping di default per errori non riconosciuti
 */
const DEFAULT_ERROR_MAPPING = {
    heuresysCode: ErrorCodes.DB.SYSTEM_ERROR,
    httpStatus: 500,
    messagePrefix: 'Errore database',
    category: 'system'
};
/**
 * Converte un errore PostgreSQL in HeuresysError
 */
export function handleDatabaseError(error, query) {
    const sqlState = error.code || 'XX000';
    const mapping = PostgresErrorMapping[sqlState] ?? PostgresErrorMapping['XX000'] ?? DEFAULT_ERROR_MAPPING;
    // Estrai contesto dal messaggio se non presente nell'errore
    const extracted = extractFromMessage(error.message);
    const table = error.table || extracted.table;
    const column = error.column || extracted.column;
    const constraint = error.constraint || extracted.constraint;
    // Genera messaggio user-friendly
    let userMessage = mapping.messagePrefix;
    switch (sqlState) {
        case '23505': // UNIQUE violation
            userMessage = constraint
                ? getConstraintMessage(constraint, table, column)
                : `Valore duplicato${column ? ` per '${column}'` : ''}. Esiste già un record con questo valore.`;
            break;
        case '23503': // FOREIGN KEY violation
            userMessage = constraint
                ? getConstraintMessage(constraint, table, column)
                : `Impossibile ${error.detail?.includes('update or delete') ? 'eliminare/modificare' : 'inserire'} il record - ${error.detail?.includes('update or delete')
                    ? 'esistono record collegati che dipendono da questo'
                    : 'il riferimento specificato non esiste'}`;
            break;
        case '23502': // NOT NULL violation
            userMessage = column
                ? `Il campo '${column}' è obbligatorio`
                : 'Uno o più campi obbligatori non sono stati compilati';
            break;
        case '23514': // CHECK constraint violation
            userMessage = constraint
                ? getConstraintMessage(constraint, table, column)
                : 'Il valore inserito non rispetta le regole di validazione';
            break;
        case '42P01': // Undefined table
            userMessage = table
                ? `Tabella '${table}' non trovata`
                : 'Tabella non trovata nel database';
            break;
        case '42703': // Undefined column
            userMessage = column
                ? `Colonna '${column}' non trovata${table ? ` nella tabella '${table}'` : ''}`
                : 'Colonna non trovata';
            break;
        case '22P02': // Invalid text representation
            userMessage = 'Formato dati non valido. Verifica i valori inseriti.';
            break;
        case '22001': // String too long
            userMessage = column
                ? `Il valore per '${column}' è troppo lungo`
                : 'Uno dei valori inseriti supera la lunghezza massima consentita';
            break;
        case '08000':
        case '08003':
        case '08006':
            userMessage = 'Connessione al database non disponibile. Riprova tra qualche istante.';
            break;
        case '40001': // Serialization failure
            userMessage = 'Conflitto di accesso concorrente. Riprova l\'operazione.';
            break;
        case '40P01': // Deadlock
            userMessage = 'Rilevato deadlock. L\'operazione è stata annullata. Riprova.';
            break;
        case '53300': // Too many connections
            userMessage = 'Il sistema è temporaneamente sovraccarico. Riprova tra qualche istante.';
            break;
        case '57014': // Query canceled
            userMessage = 'L\'operazione ha impiegato troppo tempo ed è stata annullata.';
            break;
    }
    // Costruisci il contesto database
    const databaseContext = {
        query: process.env.NODE_ENV !== 'production' ? (query || error.internalQuery) : undefined,
        table,
        column,
        constraint,
        schema: error.schema,
        errorCode: sqlState,
        detail: error.detail,
        hint: error.hint,
        position: error.position ? parseInt(error.position) : undefined
    };
    return createHeuresysError({
        code: mapping.heuresysCode,
        message: userMessage,
        category: 'DB',
        severity: mapping.category === 'connection' || mapping.category === 'system' ? 'CRITICAL' : 'ERROR',
        httpStatus: mapping.httpStatus,
        details: {
            sqlState,
            originalMessage: error.message,
            category: mapping.category
        },
        databaseContext,
        originalError: error,
        retryable: ['connection', 'transaction'].includes(mapping.category) || sqlState === '40001' || sqlState === '40P01',
        suggestion: error.hint || getSuggestionForError(sqlState, table, column, constraint)
    });
}
/**
 * Genera suggerimenti per errori comuni
 */
function getSuggestionForError(sqlState, _table, column, _constraint) {
    switch (sqlState) {
        case '23505':
            return column
                ? `Usa un valore diverso per '${column}' o modifica il record esistente`
                : 'Verifica che non esista già un record con gli stessi valori';
        case '23503':
            return 'Verifica che il record collegato esista e sia valido';
        case '23502':
            return column
                ? `Fornisci un valore per il campo obbligatorio '${column}'`
                : 'Compila tutti i campi obbligatori';
        case '23514':
            return 'Verifica che i valori inseriti rispettino i requisiti del campo';
        case '22001':
            return 'Riduci la lunghezza del testo inserito';
        case '22P02':
            return 'Verifica il formato dei dati inseriti (numeri, date, ecc.)';
        case '40001':
        case '40P01':
            return 'Riprova l\'operazione tra qualche istante';
        case '08000':
        case '08006':
            return 'Il servizio database potrebbe essere temporaneamente non disponibile. Riprova più tardi.';
        default:
            return 'Se il problema persiste, contatta il supporto tecnico';
    }
}
/**
 * Verifica se un errore è un errore PostgreSQL
 */
export function isPostgresError(error) {
    return (error instanceof Error &&
        ('code' in error || 'severity' in error) &&
        (typeof error.code === 'string' ||
            ['ERROR', 'FATAL', 'PANIC', 'WARNING', 'NOTICE'].includes(error.severity)));
}
/**
 * Wrapper per query con error handling automatico
 */
export async function safeQuery(queryFn, queryString) {
    try {
        return await queryFn();
    }
    catch (error) {
        if (isPostgresError(error)) {
            throw handleDatabaseError(error, queryString);
        }
        throw error;
    }
}
//# sourceMappingURL=database.js.map