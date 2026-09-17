package com.sanad.offline;

public class Transaction {
    public long id;
    public double amount;
    public String currency = "AED";
    public String merchant = "";
    public String category = "other";
    public String note = "";
    public String rawText = "";
    public String source = "manual";
    public double confidence = 0.0;
    public long txTime = System.currentTimeMillis();
    public boolean income = false;

    public boolean hasAmount() { return amount > 0; }
}
