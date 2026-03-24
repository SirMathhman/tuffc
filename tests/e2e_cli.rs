use std::process::Command;

#[test]
fn prints_greeting() {
    let binary_name = env!("CARGO_PKG_NAME");
    let output = Command::new("cargo")
        .args(["run", "--quiet"])
        .output()
        .expect("failed to run cargo run");

    assert!(
        output.status.success(),
        "expected successful exit for {binary_name}"
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert_eq!(stdout.trim(), "Hello, world!");
}
