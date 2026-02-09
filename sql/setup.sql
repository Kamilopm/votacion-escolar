-- ============================================
-- SISTEMA DE VOTACIÓN ESCOLAR - SQL COMPLETO
-- ============================================

-- Requisitos
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    election_status TEXT NOT NULL DEFAULT 'closed' CHECK (election_status IN ('open', 'closed')),
    admin_code TEXT NOT NULL DEFAULT 'ADMIN2026',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración inicial
INSERT INTO config (id, election_status, admin_code) 
VALUES (1, 'closed', 'ADMIN2026')
ON CONFLICT (id) DO NOTHING;

-- Tabla de estudiantes
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
    course INTEGER NOT NULL CHECK (course BETWEEN 1 AND 20),
    list_number INTEGER NOT NULL,
    access_code TEXT UNIQUE NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(grade, course, list_number)
);

-- Tabla de candidatos
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    party TEXT,
    votes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de votos (registro histórico)
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    student_id UUID REFERENCES students(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_students_access_code ON students(access_code);
CREATE INDEX IF NOT EXISTS idx_students_grade_course ON students(grade, course);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);

-- ============================================
-- FUNCIÓN ATÓMICA CRÍTICA: CAST_VOTE
-- ============================================

CREATE OR REPLACE FUNCTION cast_vote(
    p_access_code TEXT,
    p_candidate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_election_status TEXT;
BEGIN

    -- Verificar que la votación esté abierta
    SELECT election_status INTO v_election_status 
    FROM config WHERE id = 1;
    
    IF v_election_status != 'open' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'La votación está cerrada'
        );
    END IF;

    -- Buscar estudiante y bloquear fila (FOR UPDATE)
    SELECT * INTO v_student 
    FROM students 
    WHERE access_code = p_access_code
    FOR UPDATE;

    -- Verificar existencia
    IF v_student IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Código de acceso no válido'
        );
    END IF;

    -- Verificar si ya votó
    IF v_student.has_voted THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Este código ya ha sido utilizado'
        );
    END IF;

    -- Verificar que el candidato existe
    IF NOT EXISTS (SELECT 1 FROM candidates WHERE id = p_candidate_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Candidato no válido'
        );
    END IF;

    -- TODO EN UNA TRANSACCIÓN ATÓMICA:

    -- 1. Marcar como votado
    UPDATE students 
    SET has_voted = TRUE 
    WHERE id = v_student.id;

    -- 2. Insertar registro de voto
    INSERT INTO votes (candidate_id, student_id)
    VALUES (p_candidate_id, v_student.id);

    -- 3. Incrementar contador (evita race conditions)
    UPDATE candidates 
    SET votes = votes + 1 
    WHERE id = p_candidate_id;

    -- Retornar éxito con info del estudiante (sin código)
    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'name', v_student.full_name,
            'grade', v_student.grade,
            'course', v_student.course
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Error del sistema: ' || SQLERRM
    );
END;
$$;

-- ============================================
-- FUNCIÓN PARA GENERAR CÓDIGOS ÚNICOS
-- ============================================

CREATE OR REPLACE FUNCTION generate_access_code(
    p_grade INTEGER,
    p_course INTEGER,
    p_list_number INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Formato: <grado><curso><lista con 2 dígitos>
    RETURN p_grade::TEXT || 
           p_course::TEXT || 
           LPAD(p_list_number::TEXT, 2, '0');
END;
$$;

-- ============================================
-- TRIGGER PARA AUTO-GENERAR CÓDIGOS
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_access_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
        NEW.access_code := generate_access_code(
            NEW.grade, 
            NEW.course, 
            NEW.list_number
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_code ON students;
CREATE TRIGGER trigger_auto_code
    BEFORE INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_access_code();

-- ============================================
-- VISTAS ÚTILES PARA EL ADMIN
-- ============================================

CREATE OR REPLACE VIEW participation_by_grade AS
SELECT 
    grade,
    COUNT(*) as total_students,
    SUM(CASE WHEN has_voted THEN 1 ELSE 0 END) as voted,
    ROUND(
        100.0 * SUM(CASE WHEN has_voted THEN 1 ELSE 0 END) / COUNT(*), 
        1
    ) as participation_percent
FROM students
GROUP BY grade
ORDER BY grade;

CREATE OR REPLACE VIEW election_results AS
SELECT 
    c.id,
    c.name,
    c.party,
    c.votes,
    CASE 
        WHEN (SELECT SUM(votes) FROM candidates) > 0 
        THEN ROUND(100.0 * c.votes / (SELECT SUM(votes) FROM candidates), 2)
        ELSE 0 
    END as percentage
FROM candidates c
ORDER BY c.votes DESC;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Nota: En Supabase, el "service_role" bypass RLS.
-- Estas policies son opcionales, pero no hacen daño.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='service_all_students') THEN
    CREATE POLICY service_all_students ON students FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='service_all_candidates') THEN
    CREATE POLICY service_all_candidates ON candidates FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='service_all_votes') THEN
    CREATE POLICY service_all_votes ON votes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='service_all_config') THEN
    CREATE POLICY service_all_config ON config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;
