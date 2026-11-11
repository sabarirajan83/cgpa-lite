const GRADES = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, U: 0, SA: 0, WD: 0 };
const PASSING = ['O', 'A+', 'A', 'B+', 'B', 'C'];
let uid = 0, semCount = 0;
let isRestoring = false;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function gradeSelect(selectedGrade = 'O') {
    return '<select onchange="onDataChanged()">' +
        Object.keys(GRADES).map(g => `<option value="${g}" ${g === selectedGrade ? 'selected' : ''}>${g} — ${GRADES[g]} pts</option>`).join('') +
        '</select>';
}

function addCourse(prefix, containerId, initialData = null) {
    const id = ++uid;
    const row = document.createElement('div');
    row.className = 'course-row';
    row.id = `row-${id}`;
    const nameVal = initialData && initialData.name !== undefined ? escapeHtml(initialData.name) : '';
    const creditsVal = initialData && initialData.credits !== undefined ? initialData.credits : 3;
    const gradeVal = initialData && initialData.grade ? initialData.grade : 'O';

    row.innerHTML = `
      <input type="text" placeholder="Course name (optional)" value="${nameVal}" oninput="saveAllData()">
      <input type="number" placeholder="Credits" min="0.5" step="0.5" value="${creditsVal}" oninput="onDataChanged()" onchange="onDataChanged()">
      ${gradeSelect(gradeVal)}
      <button class="del-btn" onclick="delRow('row-${id}')" title="Remove"><i class="ti ti-x"></i></button>`;
    const container = document.getElementById(containerId);
    if (container) {
        container.appendChild(row);
    }
    if (!isRestoring) {
        saveAllData();
    }
    return row;
}

function delRow(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
    onDataChanged();
}

function getCourses(containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return [];
    return Array.from(cont.querySelectorAll('.course-row')).map(row => {
        const inputs = row.querySelectorAll('input');
        const sel = row.querySelector('select');
        return {
            name: inputs[0] ? inputs[0].value : '',
            credits: inputs[1] ? (parseFloat(inputs[1].value) || 0) : 0,
            grade: sel ? sel.value : 'O'
        };
    });
}

function getAllSemestersData() {
    const sems = document.querySelectorAll('[id^="semester-"]');
    return Array.from(sems).map(sem => {
        const id = sem.id.replace('semester-', '');
        return {
            id,
            courses: getCourses(`sem-courses-${id}`)
        };
    });
}

function computeGPA(courses) {
    let sumCP = 0, sumC = 0;
    courses.forEach(({ credits, grade }) => {
        if (PASSING.includes(grade) && credits > 0) {
            sumCP += credits * GRADES[grade];
            sumC += credits;
        }
    });
    return sumC > 0 ? { gpa: sumCP / sumC, totalCredits: sumC } : { gpa: null, totalCredits: 0 };
}

function classifyGPA(g) {
    if (g === null) return ['—', ''];
    if (g >= 8.5) return ['First Class with Distinction', 'badge-distinction'];
    if (g >= 6.5) return ['First Class', 'badge-first'];
    return ['Second Class', 'badge-second'];
}

function renderResult(containerId, gpa, totalCredits, label) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const [cls, badgeCls] = classifyGPA(gpa);
    const pct = gpa !== null ? (gpa * 10).toFixed(2) : '—';
    cont.style.display = 'grid';
    cont.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${gpa !== null ? gpa.toFixed(2) : '—'}</div>
        <div class="metric-sub">out of 10.00</div>
        ${gpa !== null ? `<span class="badge ${badgeCls}">${cls}</span>` : ''}
      </div>
      <div class="metric-card">
        <div class="metric-label">Percentage of marks</div>
        <div class="metric-value">${pct}${gpa !== null ? '%' : ''}</div>
        <div class="metric-sub">${totalCredits} credit(s) counted</div>
      </div>`;
}

function saveResult(type, data) {
    try {
        const jsonStr = JSON.stringify(data);
        const typeKey = type.toLowerCase();

        // Type-specific keys (both camelCase and snake_case)
        localStorage.setItem(`${typeKey}Result`, jsonStr);
        localStorage.setItem(`${typeKey}_result`, jsonStr);

        // General/latest calculation keys
        localStorage.setItem('lastResult', jsonStr);
        localStorage.setItem('calculatedResult', jsonStr);
        localStorage.setItem('result', jsonStr);

        // Aggregated results object
        let allResults = {};
        try {
            const stored = localStorage.getItem('calculatorResults');
            if (stored) {
                allResults = JSON.parse(stored);
            }
        } catch (_) {}
        allResults[typeKey] = data;
        allResults.lastUpdated = data.updatedAt;
        localStorage.setItem('calculatorResults', JSON.stringify(allResults));
    } catch (e) {
        console.error('Failed to save result to localStorage:', e);
    }
}

function getSavedResult(type) {
    try {
        const key = type ? `${type.toLowerCase()}Result` : 'lastResult';
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Failed to read result from localStorage:', e);
        return null;
    }
}

function saveAllData() {
    if (isRestoring) return;
    try {
        const gpaCourses = getCourses('gpa-courses');
        const cgpaSemesters = getAllSemestersData();

        const state = {
            gpaCourses,
            cgpaSemesters,
            gpaResult: getSavedResult('gpa'),
            cgpaResult: getSavedResult('cgpa'),
            updatedAt: new Date().toISOString()
        };

        const stateJson = JSON.stringify(state);
        localStorage.setItem('cgpa_calculator_state', stateJson);
        localStorage.setItem('cgpaCalculatorData', stateJson);
        localStorage.setItem('gpaCourses', JSON.stringify(gpaCourses));
        localStorage.setItem('cgpaSemesters', JSON.stringify(cgpaSemesters));
    } catch (e) {
        console.error('Failed to save state to localStorage:', e);
    }
}

function onDataChanged() {
    updateLive();
    saveAllData();
}

function calcGPA() {
    const courses = getCourses('gpa-courses');
    const { gpa, totalCredits } = computeGPA(courses);
    const err = document.getElementById('gpa-err');
    if (gpa === null) {
        err.style.display = 'block';
        document.getElementById('gpa-result').style.display = 'none';
        try {
            localStorage.removeItem('gpaResult');
            localStorage.removeItem('gpa_result');
        } catch (_) {}
        saveAllData();
        return;
    }
    err.style.display = 'none';
    renderResult('gpa-result', gpa, totalCredits, 'Semester GPA');

    const [cls] = classifyGPA(gpa);
    const resultData = {
        type: 'gpa',
        label: 'Semester GPA',
        gpa: parseFloat(gpa.toFixed(2)),
        value: parseFloat(gpa.toFixed(2)),
        totalCredits: totalCredits,
        percentage: parseFloat((gpa * 10).toFixed(2)),
        classification: cls,
        courses: courses,
        updatedAt: new Date().toISOString()
    };
    saveResult('gpa', resultData);
    saveAllData();
}

function addSemester(semesterData = null) {
    const id = ++semCount;
    const cont = document.getElementById('cgpa-semesters');
    if (!cont) return;
    const sem = document.createElement('div');
    sem.className = 'card';
    sem.id = `semester-${id}`;
    sem.innerHTML = `
      <div class="sem-header">
        <span class="sem-title">Semester ${id}</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="sem-gpa-live" id="live-gpa-${id}">GPA: —</span>
          <button class="del-btn" onclick="removeSemester('semester-${id}')" title="Remove semester"><i class="ti ti-x"></i></button>
        </div>
      </div>
      <div class="row-header">
        <span>Course name</span><span>Credits</span><span>Grade</span><span></span>
      </div>
      <div id="sem-courses-${id}"></div>
      <button class="add-btn" onclick="addCourse('s${id}','sem-courses-${id}')">
        <i class="ti ti-plus"></i> Add course
      </button>`;
    cont.appendChild(sem);

    if (semesterData && Array.isArray(semesterData.courses) && semesterData.courses.length > 0) {
        semesterData.courses.forEach(c => addCourse(`s${id}`, `sem-courses-${id}`, c));
    } else {
        addCourse(`s${id}`, `sem-courses-${id}`);
        addCourse(`s${id}`, `sem-courses-${id}`);
        addCourse(`s${id}`, `sem-courses-${id}`);
    }
    updateLive();
    if (!isRestoring) {
        saveAllData();
    }
}

function removeSemester(semId) {
    const el = document.getElementById(semId);
    if (el) el.remove();
    onDataChanged();
}

function calcCGPA() {
    const sems = document.querySelectorAll('[id^="semester-"]');
    let totalCP = 0, totalC = 0;
    sems.forEach(sem => {
        const id = sem.id.replace('semester-', '');
        getCourses(`sem-courses-${id}`).forEach(({ credits, grade }) => {
            if (PASSING.includes(grade) && credits > 0) {
                totalCP += credits * GRADES[grade];
                totalC += credits;
            }
        });
    });
    const err = document.getElementById('cgpa-err');
    if (totalC === 0) {
        err.style.display = 'block';
        document.getElementById('cgpa-result').style.display = 'none';
        try {
            localStorage.removeItem('cgpaResult');
            localStorage.removeItem('cgpa_result');
        } catch (_) {}
        saveAllData();
        return;
    }
    err.style.display = 'none';
    const cgpa = totalCP / totalC;
    renderResult('cgpa-result', cgpa, totalC, 'CGPA');

    const [cls] = classifyGPA(cgpa);
    const resultData = {
        type: 'cgpa',
        label: 'CGPA',
        cgpa: parseFloat(cgpa.toFixed(2)),
        value: parseFloat(cgpa.toFixed(2)),
        totalCredits: totalC,
        percentage: parseFloat((cgpa * 10).toFixed(2)),
        classification: cls,
        semesters: getAllSemestersData(),
        updatedAt: new Date().toISOString()
    };
    saveResult('cgpa', resultData);
    saveAllData();
}

function updateLive() {
    document.querySelectorAll('[id^="semester-"]').forEach(sem => {
        const id = sem.id.replace('semester-', '');
        const { gpa } = computeGPA(getCourses(`sem-courses-${id}`));
        const el = document.getElementById(`live-gpa-${id}`);
        if (el) el.textContent = `GPA: ${gpa !== null ? gpa.toFixed(2) : '—'}`;
    });
}

function switchTab(name, btn) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    const targetPanel = document.getElementById(`tab-${name}`);
    if (targetPanel) targetPanel.classList.add('active');
    if (btn) btn.classList.add('active');
}

function loadSavedState() {
    try {
        let savedState = null;
        const rawState = localStorage.getItem('cgpa_calculator_state') || localStorage.getItem('cgpaCalculatorData');
        if (rawState) {
            savedState = JSON.parse(rawState);
        }

        let gpaCourses = savedState?.gpaCourses;
        if (!gpaCourses) {
            const rawGpaCourses = localStorage.getItem('gpaCourses');
            if (rawGpaCourses) gpaCourses = JSON.parse(rawGpaCourses);
        }

        let cgpaSemesters = savedState?.cgpaSemesters;
        if (!cgpaSemesters) {
            const rawSemesters = localStorage.getItem('cgpaSemesters');
            if (rawSemesters) cgpaSemesters = JSON.parse(rawSemesters);
        }

        isRestoring = true;

        // Restore GPA courses
        const gpaContainer = document.getElementById('gpa-courses');
        if (gpaContainer) {
            gpaContainer.innerHTML = '';
            if (Array.isArray(gpaCourses) && gpaCourses.length > 0) {
                gpaCourses.forEach(c => addCourse('gpa', 'gpa-courses', c));
            } else {
                addCourse('gpa', 'gpa-courses');
                addCourse('gpa', 'gpa-courses');
                addCourse('gpa', 'gpa-courses');
            }
        }

        // Restore CGPA Semesters
        const cgpaContainer = document.getElementById('cgpa-semesters');
        if (cgpaContainer) {
            cgpaContainer.innerHTML = '';
            semCount = 0;
            if (Array.isArray(cgpaSemesters) && cgpaSemesters.length > 0) {
                cgpaSemesters.forEach(s => addSemester(s));
            } else {
                addSemester();
                addSemester();
            }
        }

        updateLive();

        // Restore GPA result if previously calculated
        const gpaResult = savedState?.gpaResult || getSavedResult('gpa');
        if (gpaResult && gpaResult.gpa !== undefined && gpaResult.totalCredits !== undefined) {
            renderResult('gpa-result', gpaResult.gpa, gpaResult.totalCredits, 'Semester GPA');
        }

        // Restore CGPA result if previously calculated
        const cgpaResult = savedState?.cgpaResult || getSavedResult('cgpa');
        if (cgpaResult && (cgpaResult.cgpa !== undefined || cgpaResult.value !== undefined) && cgpaResult.totalCredits !== undefined) {
            const val = cgpaResult.cgpa !== undefined ? cgpaResult.cgpa : cgpaResult.value;
            renderResult('cgpa-result', val, cgpaResult.totalCredits, 'CGPA');
        }

        isRestoring = false;
    } catch (e) {
        isRestoring = false;
        console.error('Failed to load saved state from localStorage:', e);
        initDefault();
    }
}

function initDefault() {
    const gpaContainer = document.getElementById('gpa-courses');
    if (gpaContainer && gpaContainer.children.length === 0) {
        addCourse('gpa', 'gpa-courses');
        addCourse('gpa', 'gpa-courses');
        addCourse('gpa', 'gpa-courses');
    }
    const cgpaContainer = document.getElementById('cgpa-semesters');
    if (cgpaContainer && cgpaContainer.children.length === 0) {
        addSemester();
        addSemester();
    }
    updateLive();
}

// Initialize on page load
loadSavedState();
