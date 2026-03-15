// LOGIN CAPTCHA
function generateLoginCaptcha() {
  let num1 = Math.floor(Math.random() * 10);
  let num2 = Math.floor(Math.random() * 10);
  window.loginCaptchaAnswer = num1 + num2;
  document.getElementById('loginCaptcha').innerHTML = `<p style="text-align:center;">Solve: ${num1} + ${num2} = ?</p>`;
}

window.onload = function() {
  generateLoginCaptcha();
}