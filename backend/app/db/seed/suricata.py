"""Seed Suricata management data."""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.suricata import SuricataCustomRule, SuricataNotificationSettings, SuricataProfile, SuricataSource


DEFAULT_SOURCES = [
    ("et/open", "ET Open", "Emerging Threats Open ruleset"),
    ("abuse.ch/urlhaus", "abuse.ch URLhaus", "URLhaus malware URL rules"),
    ("abuse.ch/feodotracker", "abuse.ch FeodoTracker", "Feodo botnet tracker rules"),
    ("abuse.ch/sslbl-blacklist", "abuse.ch SSLBL Blacklist", "SSL certificate blacklist rules"),
    ("oisf/trafficid", "OISF Traffic ID", "Traffic identification rules"),
]

YOUTUBE_RULES = [
    ("YouTube TLS", "Bloquea conexiones TLS hacia youtube.com.", 'reject tls $HOME_NET any -> $EXTERNAL_NET any (msg:"[BLOCKED] YouTube - TLS Connection Detected"; tls.sni; content:"youtube.com"; sid:1001001; rev:1; classtype:attempted-recon;)'),
    ("YouTube Music TLS", "Bloquea conexiones TLS hacia music.youtube.com.", 'reject tls $HOME_NET any -> $EXTERNAL_NET any (msg:"[BLOCKED] YouTube Music - TLS Connection Detected"; tls.sni; content:"music.youtube.com"; sid:1001002; rev:1; classtype:attempted-recon;)'),
    ("YouTube Mobile TLS", "Bloquea conexiones TLS hacia m.youtube.com.", 'reject tls $HOME_NET any -> $EXTERNAL_NET any (msg:"[BLOCKED] YouTube Mobile - TLS Connection Detected"; tls.sni; content:"m.youtube.com"; sid:1001003; rev:1; classtype:attempted-recon;)'),
    ("YouTube HTTP", "Bloquea requests HTTP hacia youtube.com.", 'reject http $HOME_NET any -> $EXTERNAL_NET any (msg:"[BLOCKED] YouTube - HTTP Request Detected"; http.host; content:"youtube.com"; sid:1001004; rev:1; classtype:attempted-recon;)'),
    ("YouTube Music HTTP", "Bloquea requests HTTP hacia music.youtube.com.", 'reject http $HOME_NET any -> $EXTERNAL_NET any (msg:"[BLOCKED] YouTube Music - HTTP Request Detected"; http.host; content:"music.youtube.com"; sid:1001005; rev:1; classtype:attempted-recon;)'),
    ("YouTube Mobile HTTP", "Bloquea requests HTTP hacia m.youtube.com.", 'reject http $HOME_NET any -> $EXTERNAL_NET any (msg:"[BLOCKED] YouTube Mobile - HTTP Request Detected"; http.host; content:"m.youtube.com"; sid:1001006; rev:1; classtype:attempted-recon;)'),
    ("YouTube DNS", "Detecta resoluciones DNS hacia youtube.com.", 'alert dns $HOME_NET any -> any any (msg:"DNS Query: youtube.com"; dns.query; content:"youtube.com"; sid:1001007; rev:1; classtype:attempted-recon;)'),
    ("YouTube Music DNS", "Detecta resoluciones DNS hacia music.youtube.com.", 'alert dns $HOME_NET any -> any any (msg:"DNS Query: music.youtube.com"; dns.query; content:"music.youtube.com"; sid:1001008; rev:1; classtype:attempted-recon;)'),
]

ADULT_SITES = [
    ("Pornhub", "pornhub.com", 2001001),
    ("XVideos", "xvideos.com", 2001004),
    ("XNXX", "xnxx.com", 2001007),
    ("XHamster", "xhamster.com", 2001010),
    ("RedTube", "redtube.com", 2001013),
    ("YouPorn", "youporn.com", 2001016),
    ("Tube8", "tube8.com", 2001019),
    ("SpankWire", "spankwire.com", 2001022),
    ("KeezMovies", "keezmovies.com", 2001025),
    ("Motherless", "motherless.com", 2001028),
]


def adult_rules() -> list[tuple[str, str, str]]:
    rules = [
        ("Adult QUIC/HTTP3", "Bloquea UDP/443 para evitar QUIC/HTTP3.", 'reject udp any any -> any 443 (msg:"[BLOQUEO] QUIC/HTTP3 UDP 443"; sid:2001999; rev:1; classtype:policy-violation;)')
    ]
    for label, domain, sid in ADULT_SITES:
        rules.extend(
            [
                (f"Adult {label} TLS", f"Bloquea {label} por TLS SNI.", f'reject tls any any -> any any (msg:"[BLOQUEO] {label} - TLS"; tls.sni; content:"{domain}"; nocase; sid:{sid}; rev:2; classtype:policy-violation;)'),
                (f"Adult {label} HTTP", f"Bloquea {label} por HTTP Host.", f'reject tcp any any -> any 80 (msg:"[BLOQUEO] {label} - HTTP"; flow:established,to_server; http.host; content:"{domain}"; sid:{sid + 1}; rev:2; classtype:policy-violation;)'),
                (f"Adult {label} DNS", f"Bloquea {label} por DNS query.", f'reject dns any any -> any any (msg:"[BLOQUEO] {label} - DNS"; dns.query; content:"{domain}"; nocase; sid:{sid + 2}; rev:4; classtype:policy-violation;)'),
            ]
        )
    return rules


DEFAULT_CUSTOM_RULES = YOUTUBE_RULES + adult_rules()


async def ensure_default_sources(session: AsyncSession) -> None:
    for source_name, display_name, description in DEFAULT_SOURCES:
        result = await session.execute(select(SuricataSource).where(SuricataSource.source_name == source_name))
        source = result.scalar_one_or_none()
        if source is None:
            session.add(SuricataSource(source_name=source_name, display_name=display_name, description=description, enabled=False))
        else:
            source.display_name = display_name
            source.description = description
    await session.commit()


async def ensure_default_profile(session: AsyncSession) -> SuricataProfile:
    existing = await session.execute(select(SuricataProfile).where(SuricataProfile.name == "Perfil base").order_by(SuricataProfile.created_at).limit(1))
    profile = existing.scalar_one_or_none()
    if profile is not None:
        return profile

    result = await session.execute(select(func.count(SuricataProfile.id)))
    profile = SuricataProfile(
        name="Perfil base",
        description="Perfil inicial con reglas locales migradas a la interfaz.",
        mode="IPS",
        sensitivity="medium",
        is_active=result.scalar_one() == 0,
    )
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


async def ensure_default_profile_rules(session: AsyncSession, profile: SuricataProfile) -> None:
    default_names = [name for name, _, _ in DEFAULT_CUSTOM_RULES]
    await session.execute(
        delete(SuricataCustomRule).where(
            SuricataCustomRule.profile_id != profile.id,
            SuricataCustomRule.name.in_(default_names),
        )
    )

    for name, description, rule_text in DEFAULT_CUSTOM_RULES:
        existing = await session.execute(
            select(SuricataCustomRule).where(SuricataCustomRule.profile_id == profile.id, SuricataCustomRule.name == name)
        )
        if existing.scalar_one_or_none() is not None:
            continue
        session.add(
            SuricataCustomRule(
                profile_id=profile.id,
                name=name,
                description=description,
                rule_text=rule_text,
                enabled=True,
                notify_enabled=False,
                validation_status="valid",
            )
        )
    await session.commit()


async def ensure_notification_settings(session: AsyncSession) -> None:
    result = await session.execute(select(func.count(SuricataNotificationSettings.id)))
    if result.scalar_one() == 0:
        session.add(SuricataNotificationSettings())
    await session.commit()


async def bootstrap_suricata_management(session: AsyncSession) -> None:
    await ensure_default_sources(session)
    profile = await ensure_default_profile(session)
    await ensure_default_profile_rules(session, profile)
    await ensure_notification_settings(session)
