document.addEventListener('DOMContentLoaded', function() {
    const inputEl = document.getElementById("input-el");
    const inputBtn = document.getElementById("input-btn");
    const tabBtn = document.getElementById("tab-btn");
    const deleteBtn = document.getElementById("delete-btn");
    const ulEl = document.getElementById("ul-el");
    
    let myLeads = [];

    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage;

    function loadLeads() {
        if (isChromeExtension) {
            chrome.storage.local.get(['myLeads'], function(result) {
                myLeads = result.myLeads || [];
                renderLeads();
            });
        } else {
            const leadsFromStorage = JSON.parse(localStorage.getItem("myLeads"));
            if (leadsFromStorage) {
                myLeads = leadsFromStorage;
                renderLeads();
            }
        }
    }

    function saveLeads() {
        if (isChromeExtension) {
            chrome.storage.local.set({ myLeads: myLeads });
        } else {
            localStorage.setItem("myLeads", JSON.stringify(myLeads));
        }
    }

    function renderLeads() {
        let listItems = "";
        for (let i = 0; i < myLeads.length; i++) {
            listItems += `
                <li>
                    <a target='_blank' href='${myLeads[i]}'>
                        ${myLeads[i]}
                    </a>
                </li>
            `;
        }
        ulEl.innerHTML = listItems;
    }

    inputBtn.addEventListener("click", function() {
        if (inputEl.value) {
            myLeads.push(inputEl.value);
            inputEl.value = "";
            saveLeads();
            renderLeads();
        }
    });

    if (isChromeExtension) {
        tabBtn.style.display = "block";
        tabBtn.addEventListener("click", function() {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].url) {
                    myLeads.push(tabs[0].url);
                    saveLeads();
                    renderLeads();
                }
            });
        });
    } else {
        tabBtn.style.display = "none";
    }

    deleteBtn.addEventListener("dblclick", function() {
        if (confirm("Are you sure you want to delete all leads?")) {
            myLeads = [];
            if (isChromeExtension) {
                chrome.storage.local.remove('myLeads');
            } else {
                localStorage.removeItem("myLeads");
            }
            renderLeads();
        }
    });

    inputEl.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            inputBtn.click();
        }
    });

    loadLeads();
});
