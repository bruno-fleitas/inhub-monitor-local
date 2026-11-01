import { $ } from '../core/dom.js';

export function initNav() {
  document.querySelectorAll('.nav').forEach(b => b.onclick = () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('view-' + b.dataset.view).classList.add('active');
  });
}
