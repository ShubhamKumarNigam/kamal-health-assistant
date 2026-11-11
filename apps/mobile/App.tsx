import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import * as Speech from "expo-speech";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { freshDemo, metrics, getInsights } from "../../packages/demo-data";
import {
  emptyConversation,
  timeline,
  type HealthStore,
  type HealthDocument,
  type Language,
} from "../../packages/health-core";
import { translations } from "../../packages/internationalization";
import { respond } from "../../packages/ai";
import { openVault, saveVault, closeVault, eraseVault } from "./storage";
type Tab = "home" | "timeline" | "ask" | "vault" | "privacy";
const nav: [Tab, string][] = [
  ["home", "◷"],
  ["timeline", "≡"],
  ["ask", "✧"],
  ["vault", "▧"],
  ["privacy", "◎"],
];
export default function App() {
  const [tab, setTab] = useState<Tab>("home"),
    [data, setData] = useState<HealthStore>(freshDemo),
    [language, setLanguage] = useState<Language>("en"),
    [message, setMessage] = useState(""),
    [locked, setLocked] = useState(false),
    [persisted, setPersisted] = useState(false),
    [selected, setSelected] = useState<HealthDocument | null>(null),
    [search, setSearch] = useState(""),
    [review, setReview] = useState<HealthDocument | null>(null),
    [verified, setVerified] = useState(false);
  const queue = useRef(Promise.resolve());
  const insights = getInsights(data);
  const t = translations[language];
  const rtl = language !== "en";
  useEffect(() => {
    if (persisted && !locked)
      queue.current = queue.current
        .then(() => saveVault(data))
        .catch(() =>
          Alert.alert("Save failed", "Please export a backup before leaving."),
        );
  }, [data, persisted, locked]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && persisted) {
        setLocked(true);
        setData(freshDemo());
        void queue.current.then(closeVault);
      }
    });
    return () => sub.remove();
  }, [persisted]);
  async function unlock() {
    try {
      if (
        (await LocalAuthentication.hasHardwareAsync()) &&
        (await LocalAuthentication.isEnrolledAsync())
      ) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock your KAMAL vault",
          disableDeviceFallback: false,
        });
        if (!result.success) return;
      } else {
        Alert.alert(
          "Device protection needed",
          "Set up device authentication before saving health records. The synthetic in-memory demo is still available.",
        );
        return;
      }
      await queue.current;
      const stored = await openVault();
      if (stored) setData(stored);
      setPersisted(true);
      setLocked(false);
    } catch (error) {
      Alert.alert(
        "Encrypted vault unavailable",
        error instanceof Error
          ? error.message
          : "Please use a native development build.",
      );
    }
  }
  async function importFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "text/plain"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if ((file.size || 0) > 8 * 1024 * 1024) {
      Alert.alert("File too large", "Choose a file under 8 MB.");
      return;
    }
    try {
      const fileData = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const doc: HealthDocument = {
        id: `mobile-${Date.now()}`,
        title: file.name,
        date: "2026-11-11",
        category: "Other Documents",
        country: "Not specified",
        institution: "Please verify",
        summary:
          "Imported original. Native OCR is planned; enter and verify a summary manually.",
        tags: ["Imported"],
        fields: [],
        fileData: `data:${file.mimeType || "application/octet-stream"};base64,${fileData}`,
        mime: file.mimeType,
      };
      setVerified(false);
      setReview(doc);
    } finally {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
    }
  }
  function demoImport() {
    setVerified(false);
    setReview({
      id: `demo-${Date.now()}`,
      title: "November follow-up blood panel",
      date: "2026-11-11",
      category: "Laboratory Reports",
      institution: "Demo Marina Clinic",
      country: "United Arab Emirates",
      summary:
        "Synthetic Vitamin D result: 24 ng/mL. Review with the treating clinician.",
      tags: ["Demo import"],
      text: "SYNTHETIC REPORT. Vitamin D: 24 ng/mL.",
      fields: [
        {
          label: "Vitamin D",
          value: "24 ng/mL",
          source: "Synthetic report",
          confidence: 1,
          verification: "unverified",
        },
      ],
    });
  }
  function send() {
    if (!message.trim()) return;
    const result = respond(message, data.conversation, language);
    setData((d) => ({
      ...d,
      conversation: result.state,
      messages: [
        ...d.messages,
        { role: "user", text: message },
        { role: "assistant", text: result.text },
      ],
    }));
    setMessage("");
  }
  async function notify() {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "KAMAL care reminder",
        body: "Open your care plan to review your next step.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
      },
    });
    Alert.alert(
      "Demo reminder scheduled",
      "A generic notification will appear in one minute. No medical content is in the notification.",
    );
  }
  const button = (label: string, action: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={[s.button, secondary && s.secondary]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
  if (locked)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.lock}>
          <Text style={s.brand}>KAMAL</Text>
          <Text style={s.h1}>Your story is safely paused.</Text>
          <Text style={s.body}>
            Unlock your local encrypted vault to continue.
          </Text>
          {button("Unlock with device authentication", () => void unlock())}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        <StatusBar style="dark" />
        <View style={[s.header, rtl && s.reverse]}>
          <Text style={s.brand}>
            KAMAL <Text style={s.brandSmall}>HEALTH</Text>
          </Text>
          <View style={s.languages}>
            {(["en", "ar", "ur"] as Language[]).map((l) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Language ${l}`}
                key={l}
                onPress={() => setLanguage(l)}
                style={[s.lang, language === l && s.langActive]}
              >
                <Text style={s.langText}>
                  {l === "en" ? "EN" : l === "ar" ? "ع" : "اردو"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.badge}>{t.demo.toUpperCase()}</Text>
          <Text style={[s.h1, rtl && s.rtl]}>
            {tab === "home" ? t.greeting : t[tab]}
          </Text>
          <Text style={[s.body, rtl && s.rtl]}>
            {tab === "home"
              ? t.subtitle
              : "Your health story, always with you."}
          </Text>
          {tab === "home" && (
            <>
              <View style={s.banner}>
                <Text style={s.eyebrow}>A LITTLE MORE CONNECTED</Text>
                <Text style={s.bannerTitle}>
                  Your health story.{"\n"}All in one place.
                </Text>
                <Text style={s.body}>
                  Different doctors, different countries.{"\n"}One continuous
                  story that belongs to you.
                </Text>
                {button(
                  "Explore your timeline →",
                  () => setTab("timeline"),
                  true,
                )}
              </View>
              <Text style={s.h2}>{t.today}</Text>
              <View style={s.grid}>
                {metrics.slice(0, 4).map((m) => (
                  <View style={s.metric} key={m.id}>
                    <Text style={s.metricLabel}>{m.label}</Text>
                    <Text style={s.metricValue}>
                      {m.value} <Text style={s.unit}>{m.unit}</Text>
                    </Text>
                    <View style={s.bars}>
                      {m.values.map((v, i) => (
                        <View
                          key={i}
                          style={[
                            s.bar,
                            {
                              height:
                                12 +
                                ((v - Math.min(...m.values)) /
                                  (Math.max(...m.values) -
                                    Math.min(...m.values) || 1)) *
                                  24,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={s.tiny}>{m.baseline}</Text>
                    <Text style={s.tiny}>
                      {m.source} · {m.updated}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={s.h2}>{t.insights}</Text>
              {insights.map((i) => (
                <View style={s.card} key={i.id}>
                  <Text style={s.eyebrow}>{i.level.toUpperCase()} · DEMO</Text>
                  <Text style={s.h3}>{i.title}</Text>
                  <Text style={s.body}>{i.reason}</Text>
                  <Text style={s.tiny}>
                    {i.source} · {i.period}
                  </Text>
                  <Text style={s.body}>{i.action}</Text>
                  <Text style={s.tiny}>{i.uncertainty}</Text>
                </View>
              ))}
              <Text style={s.h2}>Your next little steps</Text>
              {data.reminders.map((r) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: r.complete }}
                  onPress={() =>
                    setData((d) => ({
                      ...d,
                      reminders: d.reminders.map((x) =>
                        x.id === r.id ? { ...x, complete: !x.complete } : x,
                      ),
                    }))
                  }
                  key={r.id}
                  style={s.card}
                >
                  <Text style={s.h3}>
                    {r.complete ? "✓" : "○"} {r.title}
                  </Text>
                  <Text style={s.tiny}>
                    {r.date} · {r.time}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
          {(tab === "vault" || tab === "timeline") && (
            <>
              <TextInput
                accessibilityLabel="Search records"
                placeholder="Search your story…"
                placeholderTextColor="#7b8b7c"
                value={search}
                onChangeText={setSearch}
                style={s.input}
              />
              {button("+ Add health record", () =>
                Alert.alert(
                  "Add health record",
                  "Choose a synthetic demo or import an original.",
                  [
                    { text: "Synthetic report", onPress: demoImport },
                    {
                      text: "Import file",
                      onPress: () =>
                        void importFile().catch(() =>
                          Alert.alert(
                            "Import failed",
                            "The file could not be read.",
                          ),
                        ),
                    },
                    { text: "Cancel", style: "cancel" },
                  ],
                ),
              )}
              {timeline(data.documents)
                .filter((d) =>
                  `${d.title} ${d.country} ${d.category}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((d) => (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    style={s.card}
                    onPress={() => setSelected(d)}
                  >
                    <Text style={s.eyebrow}>
                      {d.date} · {d.category.toUpperCase()}
                    </Text>
                    <Text style={s.h3}>{d.title}</Text>
                    <Text style={s.body}>{d.summary}</Text>
                    <Text style={s.tiny}>
                      {d.institution} · {d.country}
                    </Text>
                    <Text style={s.link}>Open source record →</Text>
                  </Pressable>
                ))}
            </>
          )}
          {tab === "ask" && (
            <>
              <View style={s.card}>
                <Text style={s.eyebrow}>DEMO · STRUCTURED CONVERSATION</Text>
                <Text style={s.body}>{t.safety}</Text>
              </View>
              {data.messages.map((m, i) => (
                <View
                  key={i}
                  style={[s.card, m.role === "user" && s.userMessage]}
                >
                  <Text style={s.eyebrow}>
                    {m.role === "user" ? "YOU" : "KAMAL"}
                  </Text>
                  <Text style={[s.body, rtl && s.rtl]}>{m.text}</Text>
                  {m.role === "assistant" &&
                    button(
                      "Read aloud",
                      () =>
                        Speech.speak(m.text, {
                          language:
                            language === "en"
                              ? "en-GB"
                              : language === "ar"
                                ? "ar-AE"
                                : "ur-PK",
                        }),
                      true,
                    )}
                </View>
              ))}
              <TextInput
                accessibilityLabel={t.placeholder}
                multiline
                placeholder={t.placeholder}
                value={message}
                onChangeText={setMessage}
                style={[s.input, s.multiline, rtl && s.rtl]}
              />
              {button(t.send, send)}
              {button(
                "Use demo voice transcript",
                () =>
                  setMessage(
                    language === "en"
                      ? "I have been feeling tired for three days."
                      : language === "ar"
                        ? "أشعر بالتعب منذ ثلاثة أيام"
                        : "مجھے تین دن سے تھکاوٹ محسوس ہو رہی ہے",
                  ),
                true,
              )}
              <Text style={s.tiny}>
                Native speech recognition: planned. Read aloud uses your
                device’s speech engine. Demo transcript is editable.
              </Text>
              {button(
                "New conversation",
                () =>
                  setData((d) => ({
                    ...d,
                    messages: [],
                    conversation: emptyConversation(),
                  })),
                true,
              )}
            </>
          )}
          {tab === "privacy" && (
            <>
              <View style={s.card}>
                <Text style={s.h2}>Your Data, Your Control</Text>
                <Text style={s.body}>
                  {persisted
                    ? "SQLCipher vault unlocked. Key stored in OS secure storage."
                    : "This synthetic demo is in memory only. Enable encrypted saving with device authentication."}
                </Text>
                {button(
                  persisted ? "Lock vault" : "Enable encrypted vault",
                  () => {
                    if (persisted) {
                      setLocked(true);
                      setData(freshDemo());
                      void queue.current.then(closeVault);
                    } else void unlock();
                  },
                )}
                <Text style={s.tiny}>
                  Native development build required. This fails closed if
                  SQLCipher is unavailable. Device verification is still
                  required before real data use.
                </Text>
              </View>
              <View style={s.card}>
                <Text style={s.h2}>Share with Doctor</Text>
                <Text style={s.body}>
                  A concise synthetic visit note, with source identifiers.
                </Text>
                {button(
                  "Open native share sheet",
                  () =>
                    void Share.share({
                      title: "KAMAL synthetic handoff",
                      message: `SYNTHETIC DEMONSTRATION\nAisha Rahman, 38, Dubai\nReason: fatigue follow-up\nMedication: Vitamin D supplement, dose to verify (rx-aug)\nAllergies: not recorded; confirm with patient\nRecent records:\n${timeline(
                        data.documents,
                      )
                        .slice(0, 5)
                        .map((d) => `${d.date}: ${d.summary} [${d.id}]`)
                        .join(
                          "\n",
                        )}\nQuestions: confirm allergies, medication instructions and symptom course.\nRed flags not assessed. Not diagnostic advice.`,
                    }),
                )}
              </View>
              <View style={s.card}>
                <Text style={s.h2}>Care notifications</Text>
                <Text style={s.body}>
                  Test a local reminder without putting medical information in
                  its content.
                </Text>
                {button(
                  "Schedule a demo reminder",
                  () =>
                    void notify().catch(() =>
                      Alert.alert(
                        "Unavailable",
                        "Local notifications require device configuration.",
                      ),
                    ),
                )}
              </View>
              <View style={s.card}>
                <Text style={s.h2}>Family Health Context</Text>
                {data.family.map((f) => (
                  <Pressable
                    key={f.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: f.consent }}
                    onPress={() =>
                      setData((d) => ({
                        ...d,
                        family: d.family.map((x) =>
                          x.id === f.id ? { ...x, consent: !x.consent } : x,
                        ),
                      }))
                    }
                  >
                    <Text style={s.body}>
                      {f.relationship}: {f.condition}
                    </Text>
                    <Text style={s.link}>
                      {f.consent ? "✓ Consented" : "○ Not shared"} · separate
                      family record
                    </Text>
                  </Pressable>
                ))}
                <Text style={s.tiny}>
                  The native handoff currently excludes family history. Web
                  handoff supports selective consented inclusion.
                </Text>
              </View>
              <View style={s.card}>
                <Text style={s.h2}>Connected Health</Text>
                <Text style={s.body}>
                  Apple Health, Health Connect, hospital connections and account
                  sign-in are planned. No live device is connected.
                </Text>
              </View>
              {button(
                "Export readable records",
                () => void Share.share({ message: JSON.stringify(data) }),
                true,
              )}
              {button(
                "Reset synthetic demo",
                () =>
                  Alert.alert(
                    "Reset demo?",
                    "This replaces current demo edits.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Reset", onPress: () => setData(freshDemo()) },
                    ],
                  ),
                true,
              )}
              {button(
                "Delete local vault",
                () =>
                  Alert.alert(
                    "Delete vault?",
                    "This removes local encrypted records and their key. It cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          void queue.current
                            .then(eraseVault)
                            .then(() => {
                              setPersisted(false);
                              setData(freshDemo());
                            })
                            .catch(() =>
                              Alert.alert(
                                "Deletion failed",
                                "Vault could not be deleted.",
                              ),
                            ),
                      },
                    ],
                  ),
                true,
              )}
            </>
          )}
          <Text style={s.footer}>
            A little clarity. A lifetime of continuity.
          </Text>
        </ScrollView>
        <View style={[s.tabbar, rtl && s.reverse]}>
          {nav.map(([key, icon]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
              style={s.tab}
            >
              <Text style={[s.tabIcon, tab === key && s.active]}>{icon}</Text>
              <Text style={[s.tabLabel, tab === key && s.active]}>
                {key === "home"
                  ? "Home"
                  : key === "ask"
                    ? "Ask KAMAL"
                    : key === "privacy"
                      ? "Profile"
                      : key === "vault"
                        ? "Vault"
                        : "Timeline"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Modal
          visible={!!selected || !!review}
          animationType="slide"
          onRequestClose={() => {
            setSelected(null);
            setReview(null);
          }}
        >
          <SafeAreaView style={s.root}>
            <ScrollView contentContainerStyle={s.content}>
              {button(
                "Close",
                () => {
                  setSelected(null);
                  setReview(null);
                },
                true,
              )}
              {selected && (
                <>
                  <Text style={s.h1}>{selected.title}</Text>
                  <Text style={s.body}>{selected.summary}</Text>
                  <Text style={s.eyebrow}>
                    {selected.date} · {selected.institution}
                  </Text>
                  {selected.fields.map((f, i) => (
                    <View style={s.card} key={i}>
                      <Text style={s.h3}>
                        {f.label}: {f.value}
                      </Text>
                      <Text style={s.tiny}>
                        {f.verification} · Source: {f.source}
                      </Text>
                    </View>
                  ))}
                  <Text style={s.body}>
                    {selected.text ||
                      "Original preserved in the encrypted record when saving is enabled."}
                  </Text>
                </>
              )}
              {review && (
                <>
                  <Text style={s.h1}>Review before saving</Text>
                  <Text style={s.body}>
                    Verify every field against the original. Native extraction
                    is simulated for the preloaded report.
                  </Text>
                  <TextInput
                    accessibilityLabel="Document title"
                    value={review.title}
                    onChangeText={(value) =>
                      setReview({ ...review, title: value })
                    }
                    style={s.input}
                  />
                  <TextInput
                    accessibilityLabel="Record summary"
                    multiline
                    value={review.summary}
                    onChangeText={(value) =>
                      setReview({ ...review, summary: value })
                    }
                    style={[s.input, s.multiline]}
                  />
                  {review.fields.map((f, i) => (
                    <TextInput
                      key={i}
                      accessibilityLabel={f.label}
                      value={f.value}
                      onChangeText={(value) =>
                        setReview({
                          ...review,
                          fields: review.fields.map((x, j) =>
                            i === j ? { ...x, value } : x,
                          ),
                        })
                      }
                      style={s.input}
                    />
                  ))}
                  <Text style={s.body}>{review.text}</Text>
                  {button(
                    verified
                      ? "✓ I checked the original"
                      : "I checked the original",
                    () => setVerified(!verified),
                    true,
                  )}
                  {verified &&
                    button("Save verified record", () => {
                      setData((d) => ({
                        ...d,
                        documents: [
                          {
                            ...review,
                            fields: review.fields.map((f) => ({
                              ...f,
                              verification: "verified" as const,
                            })),
                          },
                          ...d.documents,
                        ],
                      }));
                      setReview(null);
                      setTab("timeline");
                    })}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f8f4" },
  lock: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#f7f8f4",
  },
  header: {
    paddingHorizontal: 23,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e5e9e0",
  },
  brand: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#275e50",
  },
  brandSmall: { fontSize: 9, letterSpacing: 2, color: "#8a9d7e" },
  languages: { flexDirection: "row", gap: 4 },
  lang: { padding: 10, borderRadius: 8 },
  langActive: { backgroundColor: "#e8f0df" },
  langText: { fontSize: 11, color: "#58794c" },
  content: { padding: 22, paddingBottom: 35 },
  badge: { fontSize: 8, color: "#8b9a80", letterSpacing: 1, marginBottom: 20 },
  h1: {
    fontSize: 29,
    fontWeight: "600",
    color: "#233e38",
    letterSpacing: -1,
    marginBottom: 9,
  },
  h2: { fontSize: 19, fontWeight: "600", color: "#294b3e", marginVertical: 17 },
  h3: { fontSize: 14, fontWeight: "600", color: "#2d4b3d", marginVertical: 9 },
  body: { fontSize: 12, color: "#7d8d72", lineHeight: 21 },
  tiny: { fontSize: 9, color: "#91a181", lineHeight: 16, marginTop: 6 },
  eyebrow: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#93a67f",
    marginBottom: 5,
  },
  banner: {
    backgroundColor: "#e8efdf",
    borderRadius: 20,
    padding: 25,
    marginTop: 25,
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: "500",
    color: "#34513c",
    lineHeight: 37,
    marginVertical: 12,
  },
  button: {
    backgroundColor: "#2b7965",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
    minHeight: 48,
  },
  buttonText: { fontSize: 12, fontWeight: "600", color: "white" },
  secondary: {
    backgroundColor: "#edf2e6",
    borderWidth: 1,
    borderColor: "#dde7d1",
  },
  secondaryText: { color: "#5c7d4f" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "white",
    borderRadius: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: "#e6eadf",
  },
  metricLabel: { fontSize: 10, color: "#829676" },
  metricValue: {
    fontSize: 27,
    color: "#365242",
    fontWeight: "500",
    marginTop: 14,
  },
  unit: { fontSize: 9, color: "#98a58d" },
  bars: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-end",
    height: 45,
    marginTop: 5,
  },
  bar: { flex: 1, backgroundColor: "#b1c7a1", borderRadius: 3 },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5eadc",
    padding: 20,
    borderRadius: 16,
    marginTop: 14,
  },
  link: { color: "#618854", fontSize: 11, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#dbe4d2",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    color: "#35523e",
    minHeight: 48,
    marginTop: 18,
    fontSize: 13,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  userMessage: { backgroundColor: "#e9f1e1", marginLeft: 25 },
  tabbar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e5eadc",
    paddingTop: 10,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: "center", minHeight: 46 },
  tabIcon: { fontSize: 22, color: "#a0af92" },
  tabLabel: { fontSize: 9, color: "#9aab8a", marginTop: 3 },
  active: { color: "#3d7d58" },
  footer: { fontSize: 9, color: "#a2ae95", textAlign: "center", marginTop: 35 },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  reverse: { flexDirection: "row-reverse" },
});
