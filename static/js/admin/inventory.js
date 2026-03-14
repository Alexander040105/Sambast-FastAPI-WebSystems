const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

const addProductBtn = document.getElementById("addProductBtn");
const addProductModal = document.getElementById("addProductModal");
const closeModal = document.getElementById("closeModal");

const imageInput = document.getElementById("productImage");
const preview = document.getElementById("imagePreview");

// Sidebar toggle
menuBtn.onclick = () => {
sidebar.classList.add("open");
overlay.classList.add("show");
}

closeBtn.onclick = () => {
sidebar.classList.remove("open");
overlay.classList.remove("show");
}

overlay.onclick = () => {
sidebar.classList.remove("open");
overlay.classList.remove("show");
}

// Modal toggle
addProductBtn.onclick = () => {
addProductModal.classList.add("show");
overlay.classList.add("show");
}

closeModal.onclick = () => {
addProductModal.classList.remove("show");
overlay.classList.remove("show");
}

overlay.onclick = () => {
addProductModal.classList.remove("show");
sidebar.classList.remove("open");
overlay.classList.remove("show");
}

imageInput.addEventListener("change", function(){
    const file = this.files[0];

    if(file){
        const reader = new FileReader();

        reader.onload = function(e){
            preview.innerHTML = `<img src="${e.target.result}">`;
        }

        reader.readAsDataURL(file);
    }
});