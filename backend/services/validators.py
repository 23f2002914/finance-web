"""Input validation helpers."""

def validate_amount(amount):
    """Validate and convert amount to float."""
    if amount is None:
        return 0.0
    try:
        val = float(amount)
        if val < 0:
            raise ValueError("Amount must be non-negative")
        return round(val, 2)
    except (ValueError, TypeError):
        raise ValueError(f"Invalid amount: {amount}")

def validate_split_total(splits, total_amount):
    """Validate that split amounts sum to total."""
    if not splits:
        return

    split_sum = sum(float(s.get('amount', 0)) for s in splits)
    split_sum = round(split_sum, 2)
    total = round(float(total_amount), 2)

    if abs(split_sum - total) > 0.01:  # Allow for floating point errors
        raise ValueError(f"Split total {split_sum} does not equal expense amount {total}")
