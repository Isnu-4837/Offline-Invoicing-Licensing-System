import random
import string

def generate_activation_key():
    """Generates a 14-character alphanumeric activation key formatted with hyphens."""
    characters = string.ascii_uppercase + string.digits
    # Generating 14 random characters
    key_chars = ''.join(random.choices(characters, k=14))
    
    # Formatting into blocks for readability (e.g., XXXX-XXXX-XXXX-XX)
    formatted_key = f"{key_chars[0:4]}-{key_chars[4:8]}-{key_chars[8:12]}-{key_chars[12:14]}"
    return formatted_key

if __name__ == "__main__":
    print("Generated Activation Key:")
    print(generate_activation_key())