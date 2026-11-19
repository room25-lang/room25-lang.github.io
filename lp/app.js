'use strict';
// The LP demo is independent of the product. No storage, analytics or network calls.
const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');
function closeMenu(returnFocus = false) {
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'メニューを開く');
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  mobileMenu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
});
mobileMenu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !mobileMenu.hidden) closeMenu(true); });
window.matchMedia('(min-width: 801px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

const questions = [
  { meaning: '思い出す', options: ['remember', 'borrow', 'arrive'], correct: 0, explanation: 'remember は「思い出す・覚えている」。' },
  { meaning: '続ける', options: ['forget', 'continue', 'choose'], correct: 1, explanation: 'continue は「続ける」。' },
  { meaning: '成長する', options: ['leave', 'break', 'grow'], correct: 2, explanation: 'grow は「成長する」。' }
];
let questionIndex = 0;
let correctCount = 0;
let answered = false;
const options = document.querySelector('#answer-options');
const questionText = document.querySelector('#question-text');
const nextButton = document.querySelector('#next-question');
const feedback = document.querySelector('#demo-feedback');
const bars = [...document.querySelectorAll('.demo-progress span')];
function renderQuestion(focus = false) {
  const question = questions[questionIndex];
  answered = false;
  questionText.textContent = `「${question.meaning}」は？`;
  document.querySelector('#demo-counter').textContent = `0${questionIndex + 1} / 03`;
  options.replaceChildren(...question.options.map((word, index) => {
    const button = document.createElement('button');
    button.className = 'answer';
    button.dataset.answer = String(index);
    const letter = document.createElement('span'); letter.className = 'option-letter'; letter.textContent = ['A', 'B', 'C'][index];
    const label = document.createElement('span'); label.textContent = word;
    const symbol = document.createElement('span'); symbol.className = 'answer-symbol'; symbol.setAttribute('aria-hidden', 'true'); symbol.textContent = '↗';
    button.append(letter, label, symbol);
    return button;
  }));
  feedback.textContent = '選んだ答えを、確かめてみよう。';
  feedback.className = 'demo-feedback';
  nextButton.hidden = true;
  bars.forEach((bar, index) => bar.classList.toggle('complete', index < questionIndex));
  if (focus) questionText.focus({ preventScroll: true });
}
options.addEventListener('click', event => {
  const button = event.target.closest('[data-answer]');
  if (!button || answered) return;
  answered = true;
  const selected = Number(button.dataset.answer);
  const question = questions[questionIndex];
  const correct = selected === question.correct;
  if (correct) correctCount++;
  [...options.children].forEach((option, index) => {
    option.disabled = true;
    if (index === question.correct) {
      option.classList.add('correct');
      option.querySelector('.answer-symbol').textContent = '✓';
    } else if (index === selected) {
      option.classList.add('incorrect');
      option.querySelector('.answer-symbol').textContent = '×';
    }
  });
  feedback.textContent = `${correct ? '正解！' : 'もう一歩。'} ${question.explanation}`;
  feedback.classList.add(correct ? 'is-correct' : 'is-incorrect');
  bars[questionIndex].classList.add('complete');
  nextButton.textContent = questionIndex === questions.length - 1 ? '結果を見る →' : '次の問題へ →';
  nextButton.hidden = false;
  // Keyboard users can continue without having to traverse disabled answers.
  nextButton.focus({ preventScroll: true });
});
nextButton.addEventListener('click', () => {
  if (!answered) return;
  if (questionIndex < questions.length - 1) { questionIndex++; renderQuestion(true); }
  else {
    document.querySelector('#quiz-area').hidden = true;
    document.querySelector('#quiz-result').hidden = false;
    document.querySelector('#correct-count').textContent = String(correctCount);
    document.querySelector('#demo-counter').textContent = 'FINISH';
    document.querySelector('#result-title').focus({ preventScroll: true });
  }
});
document.querySelector('#retry-demo').addEventListener('click', () => {
  questionIndex = 0; correctCount = 0;
  document.querySelector('#quiz-result').hidden = true;
  document.querySelector('#quiz-area').hidden = false;
  renderQuestion(true);
});

const screens = {
  home: { src: 'assets/app-home.webp', alt: '相棒のカイと今日の学習を表示するホーム画面', caption: 'HOME / 相棒のいるホーム' },
  learn: { src: 'assets/app-learn.webp', alt: 'beの意味と例文を確認できる実際の暗記カード', caption: 'LEARN / 一語ずつ、確かめる' },
  test: { src: 'assets/app-test.webp', alt: '日本語から英語へ、be・finish・joinの3択で回答するテスト画面', caption: 'TEST / 思い出して、答える' }
};
document.querySelectorAll('.screen-choice').forEach(button => {
  button.addEventListener('click', () => {
    const screen = screens[button.dataset.screen];
    document.querySelectorAll('.screen-choice').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active));
    });
    const image = document.querySelector('#preview-image');
    image.src = screen.src; image.alt = screen.alt;
    document.querySelector('#preview-caption').textContent = screen.caption;
  });
});
