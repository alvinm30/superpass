// Initialize Supabase
const supabaseUrl = 'https://jbfgxjobuskhoqjxthga.supabase.co';
const supabaseAnonKey = 'sb_publishable_u7Ycj-pP3rpk4Nb9my1xBA_NRaWSNQ5';
const db = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

const initDate = new Date();
const localYear = initDate.getFullYear();
const localMonth = String(initDate.getMonth() + 1).padStart(2, '0');
const localDay = String(initDate.getDate()).padStart(2, '0');

let currentUser = null;
let currentDate = `${localYear}-${localMonth}-${localDay}`;
let questionsData = [];
let debounceTimer;

// On Load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date-picker').value = currentDate;
    checkLogin();
});

// Authentication
function checkLogin() {
    const userCookie = localStorage.getItem('superpass_user');
    if (userCookie) {
        currentUser = userCookie;
        document.getElementById('current-user').textContent = currentUser;
        showScreen('dashboard-screen');
        loadQuestionsForDate();
    } else {
        showScreen('login-screen');
    }
}

function login(name) {
    localStorage.setItem('superpass_user', name);
    checkLogin();
}

function logout() {
    localStorage.removeItem('superpass_user');
    currentUser = null;
    showScreen('login-screen');
}

// UI Navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Date Handling
function changeDate(offset) {
    let date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    currentDate = date.toISOString().split('T')[0];
    document.getElementById('date-picker').value = currentDate;
    loadQuestionsForDate();
}

// Fetch Questions and Answers
async function loadQuestionsForDate() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '<div class="loading">Loading questions...</div>';
    
    let pickerDate = document.getElementById('date-picker').value;
    if (!pickerDate) {
        const initDate = new Date();
        const y = initDate.getFullYear();
        const m = String(initDate.getMonth() + 1).padStart(2, '0');
        const d = String(initDate.getDate()).padStart(2, '0');
        pickerDate = `${y}-${m}-${d}`;
        document.getElementById('date-picker').value = pickerDate;
    }
    currentDate = pickerDate;

    const { data: questions, error: qError } = await db
        .from('questions')
        .select('*')
        .eq('quiz_date', currentDate)
        .order('created_at', { ascending: true });

    if (qError) {
        container.innerHTML = `<p style="color:red">Error loading questions: ${qError.message}</p>`;
        return;
    }

    if (questions.length === 0) {
        container.innerHTML = '<p>No questions posted yet for this date.</p>';
        questionsData = [];
        return;
    }

    // Fetch answers for these questions
    const qIds = questions.map(q => q.id);
    const { data: answers, error: aError } = await db
        .from('answers')
        .select('*')
        .in('question_id', qIds);

    if (aError) {
        console.error("Error loading answers", aError);
    }

    questionsData = questions.map(q => {
        q.answers = (answers || []).filter(a => a.question_id === q.id);
        return q;
    });

    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    if (questionsData.length === 0) {
        return; // Handled in loadQuestionsForDate
    }

    const STUDENTS = ['Alvin', 'Avis', 'Martin', 'Kelly', 'Vinci'];
    const STUDENT_MAP = {
        'Alvin': 1,
        'Avis': 2,
        'Martin': 3,
        'Kelly': 4,
        'Vinci': 5
    };
    // Helper to get local date string properly
    const actualToday = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const currentViewDateObj = new Date(currentDate);
    const todayObj = new Date(new Date().toISOString().split('T')[0]);
    // The next day auto show the answer
    const isPastDate = currentViewDateObj < todayObj;

    const table = document.createElement('table');
    table.className = 'quiz-table';
    
    const thead = document.createElement('thead');
    let ths = `<th>Question</th>`;
    STUDENTS.forEach(s => ths += `<th>${s}</th>`);
    thead.innerHTML = `<tr>${ths}</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    
    // Add date row
    const dateRow = document.createElement('tr');
    // Format date like 17/4
    const shortDate = `${currentViewDateObj.getDate()}/${currentViewDateObj.getMonth() + 1}`;
    dateRow.innerHTML = `<td colspan="6" style="background-color: #fff3cd; font-weight: bold; color: #856404; padding: 10px;">${shortDate}</td>`;
    tbody.appendChild(dateRow);
    
    questionsData.forEach((q, index) => {
        const isRevealed = q.is_revealed || isPastDate;

        const authorName = Object.keys(STUDENT_MAP).find(key => STUDENT_MAP[key] === parseInt(q.author)) || q.author;

        const tr = document.createElement('tr');
        
        // Base Question formatting
        let authorControls = '';
        if (authorName === currentUser && !isRevealed) {
            authorControls = `
                <div style="margin-top: 10px; display: flex; gap: 5px;">
                    <button onclick="editQuestion('${q.id}')" class="btn-small action-btn" style="width:auto; margin:0;">Edit</button>
                </div>`;
        }

        let imageHtml = '';
        if (q.image_url) {
            imageHtml = `<br><img class="img-preview" src="${q.image_url}" onclick="zoomImage('${q.image_url}')" title="Click to zoom">`;
        }

        let html = `<td>
            <div class="latex-content"><strong>${index + 1}.</strong> ${q.content} (${authorName})${imageHtml}</div>
            ${authorControls}
        </td>`;

        const currentUserHasAnswered = q.answers.some(a => {
            const studentVal = parseInt(a.student);
            return studentVal === STUDENT_MAP[currentUser] && a.answer_text && a.answer_text.trim() !== '';
        });

        // Students loop
        STUDENTS.forEach(student => {
            if (student === authorName) {
                // Author's cell: holds the correct answer. Show in Red.
                if (currentUser === authorName) {
                    html += `<td><div style="color:red; font-weight:normal;">${q.correct_answer}</div></td>`;
                } else if (isRevealed || currentUserHasAnswered) {
                    html += `<td>
                        <div class="hide-show-wrapper">
                            <button onclick="this.nextElementSibling.style.display='block'; this.style.display='none'" class="btn-small spoiler-btn" style="margin:0; width:100%; font-size:12px;">Show Key</button>
                            <div class="the-key" style="display:none; color:red; font-weight:normal;">
                                <div style="margin-bottom:10px;">${q.correct_answer}</div>
                                <button onclick="this.parentNode.style.display='none'; this.parentNode.previousElementSibling.style.display='block'" class="btn-small spoiler-btn" style="margin:0; width:100%; font-size:12px; background:#6c757d;">Hide Key</button>
                            </div>
                        </div>
                    </td>`;
                } else {
                    html += `<td><span style="color:#adb5bd; font-size:12px; font-style:italic;">Submit answer to view key</span></td>`;
                }
            } else {
                // Regular student slot
                // We must match the student's ID (number) rather than their string name
                const studentId = STUDENT_MAP[student];
                const ansObj = q.answers.find(a => parseInt(a.student) === studentId || a.student === studentId.toString());
                const ansText = ansObj ? ansObj.answer_text : '';

                if (isRevealed) {
                    html += `<td>${ansText ? '<div>' + ansText + '</div>' : '<span style="color:#adb5bd; font-style:italic;">no answer</span>'}</td>`;
                } else {
                    if (student === currentUser) {
                        html += `
                        <td>
                            <textarea class="table-textarea" id="ans-${q.id}" placeholder="Type answer..." style="color: ${ansText ? 'blue' : 'inherit'};">${ansText}</textarea>
                            <button class="btn-small action-btn" onclick="saveAnswer('${q.id}')" style="margin-top: 8px; background: #28a745; width: 100%;">
                                ${ansText ? 'Update Answer' : 'Submit Answer'}
                            </button>
                        </td>`;
                    } else {
                        html += `<td><span style="color:#adb5bd; font-style:italic;">${ansText ? 'Answered' : 'no answer yet'}</span></td>`;
                    }
                }
            }
        });

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Re-render MathJax
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

// Setup Image Upload Preview
document.getElementById('q-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('q-image-preview').src = e.target.result;
            document.getElementById('q-image-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        removeImageUpload();
    }
});

function removeImageUpload() {
    document.getElementById('q-image').value = '';
    document.getElementById('q-image-preview').src = '';
    document.getElementById('q-image-preview-container').classList.add('hidden');
}

// Question Interactions
function showAskQuestionModal() {
    document.getElementById('question-form').reset();
    document.getElementById('q-id').value = '';
    document.getElementById('modal-title').innerText = 'Ask a Question';
    removeImageUpload();
    // Store current existing image for edit tracking
    document.getElementById('question-form').dataset.existingImage = '';
    document.getElementById('submit-question-btn').innerText = 'Save Question';
    document.getElementById('question-modal').classList.remove('hidden');
}

function editQuestion(id) {
    const q = questionsData.find(x => x.id === id);
    if (!q) return;
    document.getElementById('q-id').value = q.id;
    document.getElementById('q-content').value = q.content;
    document.getElementById('q-answer').value = q.correct_answer;
    document.getElementById('q-ref').value = q.explanation || '';
    
    // Store existing image for updates
    const form = document.getElementById('question-form');
    form.dataset.existingImage = q.image_url || '';
    removeImageUpload();
    if (q.image_url) {
        document.getElementById('q-image-preview').src = q.image_url;
        document.getElementById('q-image-preview-container').classList.remove('hidden');
    }

    document.getElementById('modal-title').innerText = 'Edit Question';
    document.getElementById('question-modal').classList.remove('hidden');
}

async function submitQuestion(e) {
    e.preventDefault();
    const id = document.getElementById('q-id').value;
    const content = document.getElementById('q-content').value;
    const correct_answer = document.getElementById('q-answer').value;
    const explanation = document.getElementById('q-ref').value;
    const btn = document.getElementById('submit-question-btn');

    // Handle Image Upload if selected
    const imageFile = document.getElementById('q-image').files[0];
    let finalImageUrl = document.getElementById('question-form').dataset.existingImage; // Keep existing by default if not replacing
    
    // If they clicked "Remove Image" (preview container is hidden) and there is no new image file, wipe it out
    if (document.getElementById('q-image-preview-container').classList.contains('hidden')) {
        finalImageUrl = null;
    }

    if (imageFile) {
        btn.innerText = 'Uploading Image...';
        btn.disabled = true;

        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        // Upload to 'question-images' bucket
        const { data: uploadData, error: uploadError } = await db.storage
            .from('question-images')
            .upload(fileName, imageFile, { upsert: true });

        if (uploadError) {
            btn.innerText = 'Save Question';
            btn.disabled = false;
            console.error("Image Upload Error Detailed: ", uploadError);
            alert("UPLOAD FAILED: The Storage Bucket rejected the image! Make sure you created the 'question-images' bucket in Supabase and gave it public UPDATE/INSERT permissions. Error: " + uploadError.message);
            return;
        }

        const { data: { publicUrl } } = db.storage.from('question-images').getPublicUrl(fileName);
        finalImageUrl = publicUrl;
    }

    btn.innerText = 'Saving Question...';

    const STUDENT_MAP = {
        'Alvin': 1, 'Avis': 2, 'Martin': 3, 'Kelly': 4, 'Vinci': 5
    };

    const payload = {
        quiz_date: currentDate,
        author: STUDENT_MAP[currentUser],
        content,
        correct_answer,
        explanation,
        image_url: finalImageUrl
    };

    let error;
    if (id) {
        const result = await db.from('questions').update(payload).eq('id', id);
        error = result.error;
    } else {
        const result = await db.from('questions').insert([payload]);
        error = result.error;
    }
    
    btn.innerText = 'Save Question';
    btn.disabled = false;

    if (error) {
        console.error("Database Insert Error Detailed: ", error);
        alert("DATABASE INSERT FAILED: Could not save the question details! Ensure the 'image_url' column exists. Error: " + error.message);
        return;
    }
    
    closeModal('question-modal');
    loadQuestionsForDate();
}

// Answer Save button
async function saveAnswer(questionId) {
    const textarea = document.getElementById(`ans-${questionId}`);
    const text = textarea.value.trim();
    if (!text) {
        alert("Please enter an answer before submitting.");
        return;
    }
    
    // Change button text to show loading briefly
    const btn = textarea.nextElementSibling;
    const oldBtnText = btn.innerText;
    btn.innerText = "Saving...";
    btn.style.opacity = "0.7";

    const STUDENT_MAP = {
        'Alvin': 1,
        'Avis': 2,
        'Martin': 3,
        'Kelly': 4,
        'Vinci': 5
    };

    // Check if answer already exists to update or insert
    const { data: existing, error: fetchErr } = await db
        .from('answers')
        .select('id')
        .match({ question_id: questionId, student: STUDENT_MAP[currentUser] })
        .single();

    let saveErr = null;
    if (existing) {
        const { error } = await db.from('answers').update({ answer_text: text }).eq('id', existing.id);
        saveErr = error;
    } else {
        const { error } = await db.from('answers').insert([{
            question_id: questionId,
            student: STUDENT_MAP[currentUser],
            answer_text: text
        }]);
        saveErr = error;
    }
    
    if (saveErr) {
        console.error("Save Answer Error:", saveErr);
        alert("Failed to save answer: " + saveErr.message);
        btn.innerText = oldBtnText;
        btn.style.opacity = "1";
        return;
    }

    // Restore button appearance visually
    setTimeout(() => {
        btn.innerText = "Updated!";
        btn.style.opacity = "1";
        setTimeout(() => loadQuestionsForDate(), 500); // Reload nicely
    }, 300);
}

// Export and trigger a direct PDF download
function exportToLatex() {
    if (questionsData.length === 0) {
        alert("No questions to export."); return;
    }

    const STUDENT_MAP_REV = {
        1: 'Alvin', 2: 'Avis', 3: 'Martin', 4: 'Kelly', 5: 'Vinci'
    };

    // Create an invisible container for the PDF generator
    const printDiv = document.createElement('div');
    printDiv.style.fontFamily = "'Poppins', sans-serif";
    printDiv.style.color = "#2b2d31";
    printDiv.style.backgroundColor = "white";
    printDiv.style.padding = "40px";
    
    let html = `
        <h1 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; font-weight: 800;">
            Superpass Daily Quiz - ${currentDate}
        </h1>
    `;

    questionsData.forEach((q, index) => {
        const authorName = STUDENT_MAP_REV[q.author] || q.author;

        html += `
        <div style="margin-bottom: 40px; page-break-inside: avoid; background: #f8f9fa; border: 1px solid #e3e5e8; border-radius: 8px; padding: 20px;">
            <div style="font-weight: 800; font-size: 1.2rem; margin-bottom: 10px; display: flex; justify-content: space-between;">
                <span>Question ${index + 1}</span>
                <span style="font-size: 0.9rem; color: #4e5058; font-weight: normal;">Asked by: ${authorName}</span>
            </div>
            <div style="font-size: 1.1rem; margin-bottom: 20px;">${q.content}</div>
        `;
        
        if (q.image_url) {
            html += `<img src="${q.image_url}" style="max-width:100%; max-height:200px; border-radius:8px; border:1px solid #e3e5e8; margin-top:10px;"><br>`;
        }

        if (q.is_revealed || q.answers.length > 0) {
            if (q.is_revealed) {
                html += `<div style="color: #d32f2f; font-weight: bold; margin-bottom: 5px;">Correct Answer: <span style="font-weight: normal;">${q.correct_answer}</span></div>`;
                if (q.explanation) {
                    html += `<div style="font-style: italic; color: #6c757d; margin-bottom: 15px;">Reference / Explanation: ${q.explanation}</div>`;
                }
            }
            
            html += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left; background: #e9ecef; font-weight: bold; width: 150px;">Student</th>
                        <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left; background: #e9ecef; font-weight: bold;">Submitted Answer</th>
                    </tr>
                </thead>
                <tbody>`;
            
            q.answers.forEach(a => {
                const sName = STUDENT_MAP_REV[a.student] || a.student;
                const aText = a.answer_text ? a.answer_text : '<span style="color:#adb5bd; font-style:italic;">No answer</span>';
                html += `<tr>
                    <td style="border: 1px solid #dee2e6; padding: 12px; text-align: left; font-size: 0.95rem;"><strong>${sName}</strong></td>
                    <td style="border: 1px solid #dee2e6; padding: 12px; text-align: left; font-size: 0.95rem;">${aText}</td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
        } else {
            html += `<div style="font-style: italic; color: #6c757d; text-align: center; padding: 20px;">(Answers are hidden)</div>`;
        }
        html += `</div>`; 
    });

    printDiv.innerHTML = html;

    // Use HTML2PDF to automatically download the PDF straight to the PC
    const opt = {
        margin: 0, 
        filename: `Superpass_Quiz_${currentDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }, // Prevents questions from splitting awkwardly
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    alert("Generating PDF... Please wait a second for the download to start.");
    html2pdf().set(opt).from(printDiv).save();
}

// -----------------------------
// Anki Flashcard Mode System
// -----------------------------
let ankiQuestions = [];
let currentAnkiIndex = 0;

function openAnkiSetup() {
    showScreen('anki-setup-screen');
}

async function startAnkiSession() {
    const rawCount = document.getElementById('anki-count').value;
    const count = parseInt(rawCount) || 5;
    
    if (count < 1) {
        alert("Please enter a valid number of questions.");
        return;
    }

    const btn = document.getElementById('anki-start-btn');
    btn.innerText = "Loading cards...";
    btn.disabled = true;

    // Fetch all questions from the database
    const { data, error } = await db.from('questions').select('*').limit(1000);
    
    btn.innerText = "Start Session";
    btn.disabled = false;

    if (error) {
        alert("Failed to load questions for Anki mode: " + error.message);
        return;
    }
    
    if (!data || data.length === 0) {
        alert("No questions found in the database yet!");
        return;
    }

    // Shuffle array (Fisher-Yates) for random questions
    const shuffled = data.sort(() => 0.5 - Math.random());
    
    // Pick the top X questions requested
    ankiQuestions = shuffled.slice(0, count);
    currentAnkiIndex = 0;

    showScreen('anki-study-screen');
    renderAnkiCard();
}

function renderAnkiCard() {
    if (currentAnkiIndex >= ankiQuestions.length) {
        alert(`Session complete! You reviewed ${ankiQuestions.length} questions. Great job!`);
        showScreen('login-screen');
        return;
    }

    const q = ankiQuestions[currentAnkiIndex];
    document.getElementById('anki-progress').innerText = `Question ${currentAnkiIndex + 1} / ${ankiQuestions.length}`;
    
    let contentHtml = q.content;
    if (q.image_url) {
        contentHtml += `<br><img class="img-preview" src="${q.image_url}" onclick="zoomImage('${q.image_url}')" title="Click to zoom" style="margin-top: 15px; border-radius: 8px; border: 1px solid #e3e5e8;">`;
    }
    document.getElementById('anki-q-content').innerHTML = contentHtml;
    
    const ansBox = document.getElementById('anki-user-answer');
    ansBox.value = '';
    ansBox.style.display = 'block';
    
    document.getElementById('anki-submit-btn').classList.remove('hidden');
    document.getElementById('anki-result').classList.add('hidden');
    
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

function submitAnkiAnswer() {
    const userAnswer = document.getElementById('anki-user-answer').value.trim();
    if (!userAnswer) {
        alert("Please type an answer to test your memory first! You can't reveal the key until you try.");
        return;
    }

    const q = ankiQuestions[currentAnkiIndex];
    
    // Hide input area, show results
    document.getElementById('anki-user-answer').style.display = 'none';
    document.getElementById('anki-submit-btn').classList.add('hidden');
    
    document.getElementById('anki-show-user').innerText = userAnswer;
    document.getElementById('anki-show-correct').innerText = q.correct_answer;
    
    const refEl = document.getElementById('anki-show-ref');
    if (q.explanation) {
        refEl.innerText = `Reference / Explanation: ${q.explanation}`;
        refEl.style.display = 'block';
    } else {
        refEl.style.display = 'none';
    }

    document.getElementById('anki-result').classList.remove('hidden');
    
    // Re-trigger LaTeX just in case the answer contains math
    if (window.MathJax) {
        window.MathJax.typesetPromise();
    }
}

function nextAnkiQuestion() {
    currentAnkiIndex++;
    renderAnkiCard();
}

function zoomImage(url) {
    document.getElementById('zoomed-image').src = url;
    document.getElementById('image-zoom-modal').classList.remove('hidden');
}

// -----------------------------
// DeepSeek AI Assistant System
// -----------------------------
let aiSessionMemory = [
    { role: 'system', content: 'You are an advanced medical expert and study assistant for a group of 5 medical students (Alvin, Avis, Martin, Kelly, Vinci). You must provide accurate, clinically sound, and evidence-based answers at a medical professional level. Use proper medical terminology, explain disease mechanisms, and keep responses high-yield, concise, and academically rigorous.' }
];

function toggleAIChat() {
    const panel = document.getElementById('ai-chat-panel');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        document.getElementById('ai-chat-btn').style.transform = 'scale(0.9)';
    } else {
        panel.classList.add('hidden');
        document.getElementById('ai-chat-btn').style.transform = 'scale(1)';
    }
}

async function fetchDeepSeekKeyFromSupabase() {
    try {
        // Query the key. Assuming you have a 'secrets' table where:
        // name = 'deepseek-key'
        // value = '<your_api_key>'
        const { data, error } = await db.from('secrets').select('value').eq('name', 'deepseek-key').single();
        if (error || !data) {
            console.error('Could not fetch secret key:', error);
            return null;
        }
        return data.value;
    } catch (e) {
        return null;
    }
}

async function sendAIMessage() {
    const inputEl = document.getElementById('ai-chat-input');
    const msg = inputEl.value.trim();
    if (!msg) return;

    inputEl.value = '';
    
    // Add User Message to UI
    const historyEl = document.getElementById('ai-chat-history');
    const userMsgEl = document.createElement('div');
    userMsgEl.style.cssText = 'background: #000; color: white; padding: 10px 15px; border-radius: 12px; align-self: flex-end; max-width: 85%;';
    userMsgEl.textContent = msg;
    historyEl.appendChild(userMsgEl);
    
    historyEl.scrollTop = historyEl.scrollHeight;

    // Loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.style.cssText = 'background: #e3e5e8; padding: 10px 15px; border-radius: 12px; align-self: flex-start; max-width: 85%; font-style: italic; color: #6c757d;';
    loadingEl.innerText = 'Thinking...';
    historyEl.appendChild(loadingEl);
    historyEl.scrollTop = historyEl.scrollHeight;

    aiSessionMemory.push({ role: 'user', content: msg });

    try {
        const apiKey = await fetchDeepSeekKeyFromSupabase();
        
        if (!apiKey) {
            throw new Error("API Key NOT FOUND. Please ensure you created a 'secrets' table in Supabase with a row where name='deepseek-key' and value=<your_key>.");
        }

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: aiSessionMemory,
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
        
        const json = await response.json();
        const reply = json.choices[0].message.content;

        aiSessionMemory.push({ role: 'assistant', content: reply });

        // Remove loading state & add real reply
        historyEl.removeChild(loadingEl);
        
        const aiReplyEl = document.createElement('div');
        aiReplyEl.style.cssText = 'background: #e3e5e8; padding: 10px 15px; border-radius: 12px; align-self: flex-start; max-width: 85%; line-height: 1.5; font-size: 0.95rem; overflow-x: auto;';
        
        // Parse markdown text using imported Marked.js library
        if (typeof marked !== 'undefined') {
            aiReplyEl.innerHTML = marked.parse(reply);
        } else {
            aiReplyEl.innerHTML = reply.replace(/\n/g, '<br>');
        }
        
        // Minor CSS fixes for markdown outputs (margins for lists/paragraphs)
        const subEls = aiReplyEl.querySelectorAll('p, ul, ol, h1, h2, h3, h4');
        subEls.forEach(el => el.style.margin = '5px 0');

        historyEl.appendChild(aiReplyEl);

        if (window.MathJax) {
            window.MathJax.typesetPromise([aiReplyEl]);
        }
        
    } catch (e) {
        historyEl.removeChild(loadingEl);
        const errorEl = document.createElement('div');
        errorEl.style.cssText = 'background: #f8d7da; color: #721c24; padding: 10px 15px; border-radius: 12px; align-self: flex-start; max-width: 85%; border: 1px solid #f5c6cb; font-size: 0.9rem;';
        errorEl.innerText = e.message;
        historyEl.appendChild(errorEl);
    }
    
    historyEl.scrollTop = historyEl.scrollHeight;
}

// -----------------------------
// Top-Left Chat Resizer Logic
// -----------------------------
const chatPanel = document.getElementById('ai-chat-panel');
const chatResizer = document.getElementById('chat-resize-handle');

let isChatResizing = false;
let initialChatWidth, initialChatHeight, initialMouseX, initialMouseY;

if (chatResizer) {
    chatResizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isChatResizing = true;
        initialChatWidth = chatPanel.offsetWidth;
        initialChatHeight = chatPanel.offsetHeight;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        
        document.addEventListener('mousemove', resizeChatLogic);
        document.addEventListener('mouseup', stopChatResize);
    });
}

function resizeChatLogic(e) {
    if (!isChatResizing) return;
    
    // Calculate how far the mouse has moved up and left
    const dx = initialMouseX - e.clientX;
    const dy = initialMouseY - e.clientY;
    
    // Because the panel is anchored at bottom/right, 
    // expanding left means increasing width, expanding up means increasing height.
    chatPanel.style.width = Math.max(300, initialChatWidth + dx) + 'px';
    chatPanel.style.height = Math.max(400, initialChatHeight + dy) + 'px';
}

function stopChatResize() {
    isChatResizing = false;
    document.removeEventListener('mousemove', resizeChatLogic);
    document.removeEventListener('mouseup', stopChatResize);
}


/* =========================================
   Tutorial System
========================================= */
const tutorialSteps = [
    { title: "Select Your Account", text: "First, click on your name from the login screen to enter your personalized dashboard.", icon: "??" },
    { title: "Daily Questions", text: "Once logged in, you'll see the daily board. You can navigate dates using the calendar at the top right to view past questions.", icon: "??" },
    { title: "Answer & Learn", text: "Type your answer and submit! Correct answers remain hidden until revealed, so everyone gets a fair chance to guess.", icon: "??" },
    { title: "Add Your Own", text: "Click the '+ Add Question' button at the top to challenge your friends with a new puzzle or question.", icon: "?" },
    { title: "Paste Images", text: "Got a screenshot? Simply Paste (Ctrl+V) directly into the question or answer text boxes to upload an image!", icon: "??" },
    { title: "Self Study Mode", text: "Click the 'Anki Flashcards' button on the login screen to privately test your memory on random past questions.", icon: "??" }
];

let currentTutorialStep = 0;

function startTutorial() {
    currentTutorialStep = 0;
    document.getElementById('tutorial-modal').classList.remove('hidden');
    renderTutorialStep();
}

function closeTutorial() {
    document.getElementById('tutorial-modal').classList.add('hidden');
}

function renderTutorialStep() {
    const step = tutorialSteps[currentTutorialStep];
    document.getElementById('tutorial-title').innerText = step.title;
    document.getElementById('tutorial-text').innerText = step.text;
    document.getElementById('tutorial-image-container').innerText = step.icon;

    const prevBtn = document.getElementById('tutorial-prev');
    const nextBtn = document.getElementById('tutorial-next');
    
    prevBtn.style.visibility = currentTutorialStep === 0 ? 'hidden' : 'visible';
    
    if (currentTutorialStep === tutorialSteps.length - 1) {
        nextBtn.innerText = "Let's Go! ??";
        nextBtn.onclick = closeTutorial;
    } else {
        nextBtn.innerHTML = "Next &rarr;";
        nextBtn.onclick = tutorialNext;
    }

    renderTutorialDots();
}

function tutorialNext() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        renderTutorialStep();
    }
}

function tutorialPrev() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        renderTutorialStep();
    }
}

function renderTutorialDots() {
    const dotsContainer = document.getElementById('tutorial-dots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < tutorialSteps.length; i++) {
        const dot = document.createElement('div');
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.background = i === currentTutorialStep ? '#a594f9' : '#555';
        dot.style.transition = 'background 0.3s';
        dotsContainer.appendChild(dot);
    }
}

/* =========================================
   Background Animation Toggle
========================================= */
let isBgMoving = true;

function toggleBgAnimation() {
    const tracks = document.querySelectorAll('.banner-track');
    const btn = document.getElementById('toggle-bg-animation');
    
    if (isBgMoving) {
        tracks.forEach(track => {
            track.style.setProperty('animation-play-state', 'paused', 'important');
        });
        btn.innerHTML = '🟢 Start Background';
        isBgMoving = false;
    } else {
        tracks.forEach(track => {
            track.style.setProperty('animation-play-state', 'running', 'important');
        });
        btn.innerHTML = '🔴 Stop Background';
        isBgMoving = true;
    }
}
