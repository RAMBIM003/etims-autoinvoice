const links=[...document.querySelectorAll('.links a')],secs=links.map(a=>document.querySelector(a.getAttribute('href')));
const mark=()=>{let i=0;secs.forEach((s,n)=>{if(s&&s.getBoundingClientRect().top<200)i=n});links.forEach((a,n)=>a.classList.toggle('active',n===i))};
addEventListener('scroll',mark);mark();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));
