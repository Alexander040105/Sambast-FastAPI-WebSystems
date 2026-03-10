const tabs = document.querySelectorAll(".tab");
const cards = document.querySelectorAll(".order-card");

tabs.forEach(tab=>{
tab.addEventListener("click",()=>{

tabs.forEach(t=>t.classList.remove("active"));
tab.classList.add("active");

let filter = tab.dataset.filter;

cards.forEach(card=>{

if(filter === "all"){
card.style.display="block";
}
else if(card.dataset.status === filter){
card.style.display="block";
}
else{
card.style.display="none";
}

});

});
});

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

menuBtn.addEventListener("click", () => {
sidebar.classList.add("open");
overlay.classList.add("show");
});

closeBtn.addEventListener("click", closeMenu);
overlay.addEventListener("click", closeMenu);

function closeMenu(){
sidebar.classList.remove("open");
overlay.classList.remove("show");
}