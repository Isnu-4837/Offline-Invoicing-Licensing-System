import tkinter as tk
import random
import string
import hashlib

CHARS = string.ascii_uppercase + string.digits
# This MUST match the APP_SECRET in your FastAPI main.py!
APP_SECRET = "ERP_SECURE_2026"

BG = "#060912"
PANEL = "#0f1830"
FIELD_BG = "#0b1220"
CYAN = "#38bdf8"
CYAN_LIGHT = "#7dd3fc"
VIOLET = "#818cf8"
MINT = "#34d399"
INK = "#e6edf7"
INK_DIM = "#8fa2c2"

_final_key = ""
_tick = 0
_pulse_step = 0
_pulse_job = None


def _rand_char():
    return random.choice(CHARS)


def _format(raw):
    return f"{raw[0:4]}-{raw[4:8]}-{raw[8:12]}-{raw[12:14]}"


def _set_status(text, color=MINT):
    status_label.config(text=text, fg=color)


def _slot_tick():
    """Animates the key field like a slot machine settling into the final key."""
    global _tick
    display = "".join(
        _final_key[i] if i < _tick else _rand_char() for i in range(14)
    )
    key_entry.config(state="normal")
    key_entry.delete(0, tk.END)
    key_entry.insert(0, _format(display))
    key_entry.config(state="readonly")

    if _tick <= 14:
        _tick += 1
        root.after(45, _slot_tick)
    else:
        _set_status("Hardware Key Generated! ✓", MINT)
        _pulse_border(6)


def _pulse_border(steps):
    """Brief glow pulse on the entry border after generation, echoing the CSS box-shadow pulse."""
    global _pulse_step
    colors = [CYAN, CYAN_LIGHT, CYAN, PANEL_BORDER_DEFAULT]
    if steps <= 0:
        key_frame.config(highlightbackground=PANEL_BORDER_DEFAULT, highlightcolor=PANEL_BORDER_DEFAULT)
        return
    color = colors[steps % len(colors)]
    key_frame.config(highlightbackground=color, highlightcolor=color)
    root.after(90, lambda: _pulse_border(steps - 1))


def _calculate_checksum(base_str):
    """Generates the 2-character signature based on the first 12 chars."""
    total = sum(ord(c) for c in base_str)
    char1 = CHARS[total % len(CHARS)]
    char2 = CHARS[(total * 7) % len(CHARS)]
    return char1 + char2


def generate_key():
    global _final_key, _tick
    
    # Grab the Machine ID typed into the box
    machine_id = machine_entry.get().strip().upper()
    if not machine_id:
        _set_status("Error: Enter Client's Machine ID!", "#fca5a5")
        return
        
    # Generate the cryptographic hardware hash
    raw_string = machine_id + APP_SECRET
    hash_hex = hashlib.sha256(raw_string.encode()).hexdigest().upper()
    
    # 1. Use 12 characters from the hardware hash as the base
    base_key = hash_hex[:12]
    
    # 2. Calculate the 2-character signature
    signature = _calculate_checksum(base_key)
    
    # 3. Combine them to make the valid 14-character key
    _final_key = base_key + signature
    
    _tick = 0
    _set_status("Encrypting…", CYAN)
    gen_btn.config(text="Encrypting…")
    root.after(0, _slot_tick)
    root.after(760, lambda: gen_btn.config(text="Generate Hardware Key 🔑"))


def copy_to_clipboard():
    value = key_entry.get()
    if not value or "X" in value:
        return
    root.clipboard_clear()
    root.clipboard_append(value)
    _set_status("Copied to clipboard! 📋", CYAN_LIGHT)
    copy_btn.config(bg="#1b2f57")
    root.after(220, lambda: copy_btn.config(bg="#182749"))


def _on_enter(btn, hover_color):
    btn.config(bg=hover_color)


def _on_leave(btn, base_color):
    btn.config(bg=base_color)


# ---------- Window setup ----------
root = tk.Tk()
root.title("License Key Generator")
# Height increased from 340 to 420 to accommodate the new input field
root.geometry("420x420") 
root.config(bg=BG)
root.resizable(False, False)
root.eval('tk::PlaceWindow . center')

PANEL_BORDER_DEFAULT = "#1c2b4d"

# Outer card with a soft "border glow" frame
card = tk.Frame(root, bg=PANEL, highlightbackground=PANEL_BORDER_DEFAULT,
                 highlightthickness=1, bd=0)
card.pack(padx=22, pady=22, fill="both", expand=True)

badge = tk.Frame(card, bg="#0d2a22")
badge.pack(pady=(22, 6))
tk.Label(badge, text="●", font=("Arial", 8), fg=MINT, bg="#0d2a22").pack(side="left", padx=(10, 4), pady=4)
tk.Label(badge, text="HARDWARE BINDING", font=("Arial", 9, "bold"), fg=MINT, bg="#0d2a22").pack(side="left", padx=(0, 10), pady=4)

title_label = tk.Label(card, text="Key Generator", font=("Segoe UI", 18, "bold"), fg=CYAN_LIGHT, bg=PANEL)
title_label.pack(pady=(5, 2))

subtitle = tk.Label(card, text="Generate secure activation keys for clients.",
                     font=("Segoe UI", 9), fg=INK_DIM, bg=PANEL)
subtitle.pack(pady=(0, 10))

# --- NEW MACHINE ID INPUT SECTION ---
tk.Label(card, text="Client Machine ID:", font=("Segoe UI", 9, "bold"), fg=INK_DIM, bg=PANEL).pack(pady=(5, 2))
machine_entry = tk.Entry(card, font=("Consolas", 11), justify="center", fg=INK, bg=FIELD_BG, relief="flat", insertbackground=CYAN)
machine_entry.pack(ipady=6, fill="x", padx=30, pady=(0, 15))
# ------------------------------------

key_frame = tk.Frame(card, bg=FIELD_BG, highlightbackground=PANEL_BORDER_DEFAULT,
                      highlightthickness=1, bd=0)
key_frame.pack(fill="x", padx=30, pady=(0, 16))

key_entry = tk.Entry(key_frame, font=("Consolas", 16, "bold"), justify="center",
                      fg=CYAN_LIGHT, bg=FIELD_BG, relief="flat", insertbackground=CYAN,
                      readonlybackground=FIELD_BG, state="readonly")
key_entry.pack(ipady=10, fill="x")

gen_btn = tk.Button(card, text="Generate Hardware Key 🔑", font=("Segoe UI", 10, "bold"),
                     bg=CYAN, fg="#04101f", relief="flat", activebackground=CYAN_LIGHT,
                     cursor="hand2", command=generate_key)
gen_btn.pack(fill="x", padx=30, pady=(0, 8), ipady=8)
gen_btn.bind("<Enter>", lambda e: _on_enter(gen_btn, CYAN_LIGHT))
gen_btn.bind("<Leave>", lambda e: _on_leave(gen_btn, CYAN))

copy_btn = tk.Button(card, text="Copy to Clipboard", font=("Segoe UI", 9, "bold"),
                      bg="#182749", fg=INK, relief="flat", activebackground="#1b2f57",
                      cursor="hand2", command=copy_to_clipboard)
copy_btn.pack(fill="x", padx=30, pady=(0, 12), ipady=6)
copy_btn.bind("<Enter>", lambda e: _on_enter(copy_btn, "#1b2f57"))
copy_btn.bind("<Leave>", lambda e: _on_leave(copy_btn, "#182749"))

status_label = tk.Label(card, text="", font=("Segoe UI", 9, "bold"), fg=MINT, bg=PANEL)
status_label.pack(pady=(0, 18))

root.mainloop()