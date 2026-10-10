"use strict";

// ==========================================
// SpendSmart: Supabase Expense Dashboard
// ==========================================

const STORAGE_KEY = "spendsmart_expenses_v2";
const BUDGET_KEY = "spendsmart_budgets_v2";

const budgetForm = document.getElementById("budgetForm");
const budgetInput = document.getElementById("budgetInput");

const expenseForm = document.getElementById("expenseForm");
const expenseName = document.getElementById("expenseName");
const expenseAmount = document.getElementById("expenseAmount");
const expenseCategory = document.getElementById("expenseCategory");
const expenseDate = document.getElementById("expenseDate");

const monthFilter = document.getElementById("monthFilter");

const budgetDisplay = document.getElementById("budgetDisplay");
const spentDisplay = document.getElementById("spentDisplay");
const remainingDisplay = document.getElementById("remainingDisplay");
const expenseCount = document.getElementById("expenseCount");

const expenseList = document.getElementById("expenseList");
const emptyState = document.getElementById("emptyState");

const budgetProgressFill = document.getElementById("budgetProgressFill");
const budgetMessage = document.getElementById("budgetMessage");

const categoryChartCanvas = document.getElementById("categoryChart");
const dailyChartCanvas = document.getElementById("dailyChart");
const spendingInsight = document.getElementById("spendingInsight");

const logoutButton = document.getElementById("logoutButton");
const userEmail = document.getElementById("userEmail");

let currentUser = null;
let expenses = [];
let budgets = {};

let categoryChart = null;
let dailyChart = null;

let busy = false;


// ==========================================
// Dates and formatting
// ==========================================

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
    return getLocalDateString().slice(0, 7);
}

function selectedMonth() {
    return monthFilter.value || getCurrentMonth();
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}


// ==========================================
// Session protection
// ==========================================

async function requireSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        throw error;
    }

    if (!data.session) {
        window.location.replace("login.html");
        return false;
    }

    currentUser = data.session.user;

    if (userEmail) {
        userEmail.textContent = currentUser.email || "";
    }

    return true;
}


// ==========================================
// Load expenses from Supabase
// ==========================================

async function loadExpenses() {
    const { data, error } = await supabaseClient
        .from("expenses")
        .select("id, name, amount, category, expense_date")
        .eq("user_id", currentUser.id)
        .order("expense_date", { ascending: false });

    if (error) {
        throw error;
    }

    expenses = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        amount: Number(item.amount),
        category: item.category,
        date: item.expense_date
    }));
}


// ==========================================
// Load budgets from Supabase
// ==========================================

async function loadBudgets() {
    const { data, error } = await supabaseClient
        .from("budgets")
        .select("id, month, amount")
        .eq("user_id", currentUser.id);

    if (error) {
        throw error;
    }

    budgets = {};

    (data || []).forEach(item => {
        budgets[item.month] = Number(item.amount);
    });
}


// ==========================================
// Budget helper
// ==========================================

function monthlyBudget() {
    return Number(budgets[selectedMonth()] || 0);
}

function monthlyExpenses() {
    return expenses.filter(expense =>
        expense.date.startsWith(selectedMonth())
    );
}

function monthlyTotal() {
    return monthlyExpenses().reduce(
        (total, expense) => total + expense.amount,
        0
    );
}


// ==========================================
// Save monthly budget to Supabase
// ==========================================

budgetForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (busy) return;

    const rawValue = budgetInput.value.trim();
    const amount = Number(rawValue);
    const month = selectedMonth();

    if (
        rawValue === "" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 1000000000
    ) {
        alert("Please enter a valid budget amount.");
        return;
    }

    busy = true;

    const submitButton = budgetForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
        const { error } = await supabaseClient
            .from("budgets")
            .upsert(
                {
                    user_id: currentUser.id,
                    month: month,
                    amount: Math.round(amount * 100) / 100,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "user_id,month"
                }
            );

        if (error) throw error;

        budgets[month] = Math.round(amount * 100) / 100;

        renderDashboard();

        alert("Monthly budget saved successfully!");
    } catch (error) {
        console.error("Budget saving error:", error);
        alert("Could not save the budget: " + error.message);
    } finally {
        busy = false;
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});


// ==========================================
// Add expense to Supabase
// ==========================================

expenseForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (busy) return;

    const name = expenseName.value.trim();
    const amount = Number(expenseAmount.value);
    const category = expenseCategory.value;
    const date = expenseDate.value;

    if (!name) {
        alert("Please enter an expense name.");
        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 100000000
    ) {
        alert("Please enter a valid expense amount.");
        return;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Please select a valid date.");
        return;
    }

    const allowedCategories = [
        "Food",
        "Transport",
        "Education",
        "Shopping",
        "Entertainment",
        "Health",
        "Other"
    ];

    if (!allowedCategories.includes(category)) {
        alert("Please select a valid category.");
        return;
    }

    busy = true;

    const submitButton = expenseForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = "Adding...";

    try {
        const { error } = await supabaseClient
            .from("expenses")
            .insert({
                user_id: currentUser.id,
                name: name,
                amount: Math.round(amount * 100) / 100,
                category: category,
                expense_date: date
            });

        if (error) throw error;

        await loadExpenses();

        monthFilter.value = date.slice(0, 7);

        expenseForm.reset();
        expenseDate.value = getLocalDateString();

        renderDashboard();

        alert("Expense added successfully!");
    } catch (error) {
        console.error("Expense saving error:", error);
        alert("Could not save the expense: " + error.message);
    } finally {
        busy = false;
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});


// ==========================================
// Delete expense from Supabase
// ==========================================

async function deleteExpense(id) {
    if (busy) return;

    if (!confirm("Are you sure you want to delete this expense?")) {
        return;
    }

    busy = true;

    try {
        const { error } = await supabaseClient
            .from("expenses")
            .delete()
            .eq("id", id)
            .eq("user_id", currentUser.id);

        if (error) throw error;

        await loadExpenses();

        renderDashboard();
    } catch (error) {
        console.error("Expense deletion error:", error);
        alert("Could not delete the expense: " + error.message);
    } finally {
        busy = false;
    }
}


// ==========================================
// Render expense history
// ==========================================

function renderExpenses() {
    const list = monthlyExpenses();

    expenseList.replaceChildren();

    emptyState.style.display =
        list.length === 0 ? "block" : "none";

    list.forEach(expense => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = expense.name;

        const categoryCell = document.createElement("td");

        const badge = document.createElement("span");
        badge.className = "category-badge";
        badge.textContent = expense.category;

        categoryCell.appendChild(badge);

        const dateCell = document.createElement("td");
        dateCell.textContent = expense.date;

        const amountCell = document.createElement("td");
        amountCell.textContent = formatMoney(expense.amount);

        const actionCell = document.createElement("td");

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteExpense(expense.id);
        });

        actionCell.appendChild(deleteButton);

        row.append(
            nameCell,
            categoryCell,
            dateCell,
            amountCell,
            actionCell
        );

        expenseList.appendChild(row);
    });

    expenseCount.textContent =
        list.length +
        (list.length === 1
            ? " expense recorded"
            : " expenses recorded");
}


// ==========================================
// Render budget summary
// ==========================================

function renderSummary() {
    const budget = monthlyBudget();
    const spent = monthlyTotal();
    const remaining = budget - spent;

    budgetDisplay.textContent = formatMoney(budget);
    spentDisplay.textContent = formatMoney(spent);
    remainingDisplay.textContent = formatMoney(remaining);

    remainingDisplay.style.color =
        remaining < 0 ? "#d32f2f" : "#087c58";

    const percentage = budget > 0
        ? (spent / budget) * 100
        : 0;

    budgetProgressFill.style.width =
        Math.min(percentage, 100) + "%";

    if (percentage > 100) {
        budgetProgressFill.style.background = "#d32f2f";

        budgetMessage.textContent =
            "Budget exceeded by " +
            formatMoney(spent - budget) + ".";

        budgetMessage.classList.add("warning");
    } else if (budget === 0) {
        budgetProgressFill.style.background = "#16a779";

        budgetMessage.textContent =
            "Set a budget to begin tracking your spending.";

        budgetMessage.classList.remove("warning");
    } else {
        budgetProgressFill.style.background = "#16a779";

        budgetMessage.textContent =
            Math.round(percentage) +
            "% of your budget used. " +
            formatMoney(remaining) + " remaining.";

        budgetMessage.classList.remove("warning");
    }
}


// ==========================================
// Analytics charts
// ==========================================

function renderAnalytics() {
    if (
        typeof Chart === "undefined" ||
        !categoryChartCanvas ||
        !dailyChartCanvas ||
        !spendingInsight
    ) {
        if (spendingInsight) {
            spendingInsight.textContent =
                "Charts could not load. Check your internet connection.";
        }

        return;
    }

    const list = monthlyExpenses();

    const categoryTotals = {};
    const dailyTotals = {};

    list.forEach(expense => {
        categoryTotals[expense.category] =
            (categoryTotals[expense.category] || 0) +
            expense.amount;

        dailyTotals[expense.date] =
            (dailyTotals[expense.date] || 0) +
            expense.amount;
    });

    const categories = Object.keys(categoryTotals);

    const categoryAmounts = categories.map(
        category => categoryTotals[category]
    );

    const dates = Object.keys(dailyTotals).sort();

    const dailyAmounts = dates.map(
        date => dailyTotals[date]
    );

    if (categoryChart) categoryChart.destroy();
    if (dailyChart) dailyChart.destroy();

    categoryChart = new Chart(categoryChartCanvas, {
        type: "doughnut",

        data: {
            labels: categories.length
                ? categories
                : ["No expenses yet"],

            datasets: [{
                data: categories.length
                    ? categoryAmounts
                    : [1],

                backgroundColor: [
                    "#16a779",
                    "#6584f5",
                    "#ffb454",
                    "#a78bfa",
                    "#f87171",
                    "#38bdf8",
                    "#94a3b8"
                ],

                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                },

                tooltip: {
                    callbacks: {
                        label: context => categories.length
                            ? context.label + ": " +
                              formatMoney(context.raw)
                            : "Add an expense to see category totals"
                    }
                }
            }
        }
    });

    dailyChart = new Chart(dailyChartCanvas, {
        type: "bar",

        data: {
            labels: dates.length
                ? dates
                : ["No expenses yet"],

            datasets: [{
                label: "Daily Spending",

                data: dates.length
                    ? dailyAmounts
                    : [0],

                backgroundColor: "#16a779",
                borderRadius: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: value => "₹" + value
                    }
                }
            },

            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    if (list.length === 0) {
        spendingInsight.textContent =
            "No expenses recorded this month. " +
            "Add your first expense to discover your spending habits.";

        return;
    }

    const highestCategory = categories.reduce(
        (highest, category) =>
            highest === null ||
            categoryTotals[category] > categoryTotals[highest]
                ? category
                : highest,
        null
    );

    spendingInsight.textContent =
        "You've spent " +
        formatMoney(monthlyTotal()) +
        " this month. Your biggest spending category is " +
        highestCategory +
        ", accounting for " +
        formatMoney(categoryTotals[highestCategory]) +
        ". Review this category to identify possible savings.";
}


// ==========================================
// Render all dashboard sections
// ==========================================

function renderDashboard() {
    budgetInput.value = monthlyBudget() || "";

    renderExpenses();
    renderSummary();
    renderAnalytics();
}


// ==========================================
// Change month
// ==========================================

monthFilter.value = getCurrentMonth();
expenseDate.value = getLocalDateString();

monthFilter.addEventListener("change", function () {
    if (!monthFilter.value) {
        monthFilter.value = getCurrentMonth();
    }

    renderDashboard();
});


// ==========================================
// Logout
// ==========================================

if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        logoutButton.disabled = true;

        try {
            const { error } = await supabaseClient.auth.signOut();

            if (error) throw error;

            window.location.replace("login.html");
        } catch (error) {
            console.error("Logout error:", error);

            alert("Could not log out: " + error.message);

            logoutButton.disabled = false;
        }
    });
}


// ==========================================
// Initialize dashboard
// ==========================================

async function initializeDashboard() {
    try {
        const authenticated = await requireSession();

        if (!authenticated) return;

        await loadExpenses();
        await loadBudgets();

        renderDashboard();

        console.log("SpendSmart dashboard connected to Supabase.");
    } catch (error) {
        console.error("Dashboard initialization error:", error);

        alert(
            "Could not load your dashboard. " +
            "Check your Supabase configuration and database policies. " +
            "Details: " + error.message
        );
    }
}


// Redirect if the user signs out elsewhere.
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        window.location.replace("login.html");
    }
});

initializeDashboard();