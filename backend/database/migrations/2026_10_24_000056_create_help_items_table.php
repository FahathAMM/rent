<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Help & Support content managed in the platform admin: stay-safe tips,
 * warning signs, emergency contacts, FAQs, and the Terms and Privacy pages.
 * Starts with the wording these pages launched with, so they aren't blank
 * after a deploy (the deploy steps run migrations, not seeders).
 * sort_order counts from 0 within each type.
 */
return new class extends Migration
{
    private const SAFETY_TIPS = [
        'Before you pay' => [
            'Wait until the shop has confirmed your booking before sending any money.',
            'Keep your booking on the site, so your dates, price and payments stay on record.',
            'Check what the price includes, such as the mileage allowance and security deposit.',
            'Only transfer money to the bank details shown on your booking.',
            'Upload your transfer receipt to the booking. It counts as paid once the shop has checked it.',
        ],
        'At pickup' => [
            'Check that the vehicle and number plate match your booking.',
            'Walk around the vehicle with the shop and photograph any existing damage.',
            'Note the fuel level and odometer reading before you leave.',
            'Ask what the insurance covers and what to do if you break down.',
        ],
        'On the road' => [
            'Carry your valid driving licence and the vehicle\'s documents.',
            'Wear seat belts or helmets, and follow local traffic laws.',
            'Never drive after drinking alcohol or when you are too tired.',
            'Tell the shop straight away about an accident, breakdown or damage.',
        ],
        'At return' => [
            'Return the vehicle on time, or ask the shop first if you need longer.',
            'Check the vehicle together with the shop, and take photos of its condition.',
            'Collect your security deposit, or agree in writing when you will get it back.',
            'Keep your receipts and photos until everything is settled.',
        ],
        'Buying a vehicle' => [
            'See the vehicle in person, and take it for a drive, before you pay anything.',
            'Check that the registration document matches the vehicle, including its chassis and engine numbers.',
            'Ask whether any lease or loan is still owed on the vehicle.',
            'If you can, have a mechanic you trust inspect it.',
            'Pay at the shop, and get a receipt and a sale agreement.',
            'Make sure the ownership transfer is completed with the Department of Motor Traffic.',
        ],
    ];

    private const WARNING_SIGNS = [
        'The price is far below similar vehicles, with pressure to pay quickly.',
        'You are asked to pay before the shop has confirmed your booking.',
        'You are asked to pay into a bank account that isn\'t shown on your booking.',
        'You are asked to share a password or one-time code. We will never ask for these.',
        'The vehicle at pickup is not the one you booked, or it looks unsafe.',
        'You are asked to pay a deposit for a vehicle before you have seen it.',
    ];

    private const EMERGENCY_CONTACTS = [
        'Police' => '119',
        'Ambulance' => '1990',
    ];

    private const FAQS = [
        'Booking' => [
            'How do I book a vehicle?' => 'Find a vehicle, choose your dates and send a booking request. The shop checks availability and confirms it. You can follow the status under My Bookings.',
            'Is my booking confirmed when I send the request?' => 'No. Your booking is confirmed only after the shop accepts your request.',
            'Can I ask a shop a question before booking?' => 'Yes. Open the vehicle\'s page and use the option to contact the shop.',
            'What should I bring to pickup?' => 'Bring your valid driving licence and ID. Requirements can vary, so check with the shop before your pickup date.',
        ],
        'Payments and deposits' => [
            'How do I pay?' => 'You pay the shop directly, by cash or bank transfer, depending on the options for your booking. We don\'t hold your money.',
            'How do bank transfers work?' => 'Once the shop confirms, its bank details appear on your booking. Transfer the advance or the full amount, then upload your receipt. The payment counts as received after the shop checks its bank statement.',
            'What is the security deposit?' => 'It\'s a refundable amount the shop holds during your rental, and it\'s handed back at return. The amount is shown when you book. Some vehicles don\'t need a deposit.',
        ],
        'Cancellations and refunds' => [
            'Can I cancel my booking?' => 'Yes, while your request is pending. You can also cancel a confirmed booking before handover, as long as you haven\'t paid the shop or uploaded a transfer.',
            'What if I\'ve already paid?' => 'Contact the shop to cancel. Refunds follow the shop\'s own policy, so check it before you pay.',
            'What if the shop cancels my booking?' => 'You\'ll get a notification with the reason. If you\'ve already paid, contact the shop about your refund. If you can\'t resolve it with them, raise a dispute.',
        ],
        'Problems and disputes' => [
            'What should I do if something goes wrong?' => 'Speak to the shop first, as this is usually the quickest fix. If that doesn\'t work, raise a dispute and our team will review it.',
            'How do I raise a dispute?' => 'Sign in and go to Disputes in your account. You can raise one on a confirmed, active or completed booking, for issues such as damage charges, overcharging, refunds or the vehicle\'s condition.',
            'How do I report a suspicious listing?' => 'Open the vehicle\'s page and choose Report this listing. Our team will review your report.',
        ],
        'For shops' => [
            'How do I list my vehicles?' => 'Register your shop and upload your business registration. Our team reviews your documents and publishes your shop once it\'s verified.',
            'How do I receive payments?' => 'Customers pay you directly by cash or bank transfer. For transfers, check your bank statement before you mark the payment as received.',
            'How do I sell a vehicle?' => 'Open Sales in your shop workspace and add a listing. Our team reviews it, then you publish it to the Buy page. How many you can list depends on your plan.',
        ],
        'Buying a vehicle' => [
            'How do I buy a vehicle?' => 'Open the Buy page, choose a vehicle and ask the shop your questions. The shop replies in your account under Enquiries, where you can arrange to see the vehicle. If you decide to buy, you pay at the shop.',
            'Can I pay for a vehicle online?' => 'No. We don\'t take payment for vehicle sales. You pay the shop directly, after you have seen the vehicle.',
            'Do I need an account to ask about a vehicle?' => 'Yes. Log in or register first, so the shop can reply to you and you can keep the whole conversation in one place.',
            'Can I negotiate the price?' => 'The listing shows whether the price is negotiable. Ask the shop in your enquiry.',
            'What happens when a vehicle is sold?' => 'It leaves the Buy page, and any other open enquiries about it are closed.',
            'Where do I find my sale agreement?' => 'The shop gives it to you when you buy. If you bought through an enquiry on this website, you can also open it from that enquiry in your account.',
        ],
    ];

    private const TERMS = [
        'About these terms' => '<p>These terms apply whenever you use this website, whether you are browsing, renting or buying a vehicle, or listing vehicles as a shop. By using the website you agree to them. If you don\'t agree, please don\'t use the website.</p>',
        'Our role' => '<p>We run an online marketplace that connects customers with independent shops. We don\'t own, rent out, sell or insure the vehicles listed here. Each rental or sale contract is between the customer and the shop, and we are not a party to it.</p>',
        'Your account' => '<p>Give accurate information when you register and keep it up to date. Keep your password private. You are responsible for what happens under your account, so tell us straight away if you think someone else has used it.</p>',
        'Bookings' => '<p>Sending a booking request doesn\'t confirm a booking. It is confirmed only after the shop accepts it. Shops are responsible for the accuracy of their listings, prices and availability.</p>',
        'Prices and payments' => '<p>You pay the shop directly, by cash or bank transfer, depending on the options for your booking. We don\'t collect or hold your money.</p><p>Only send a bank transfer to the details shown on your booking. A transfer counts as paid once the shop has checked it. Any security deposit is held by the shop, and the shop is responsible for returning it.</p>',
        'The shop\'s rental terms' => '<p>Each shop sets its own rental terms and policies, and may ask you to read and sign them at handover. Read them before you pay or sign. They apply to your rental alongside these terms, and they decide matters between you and the shop.</p>',
        'Cancellations and refunds' => '<p>You can cancel a booking on the website while your request is pending. You can also cancel a confirmed booking before handover, as long as you haven\'t paid the shop or uploaded a transfer.</p><p>After that, cancellations and refunds follow the shop\'s own policy, and any refund comes from the shop.</p>',
        'Using the vehicle' => '<p>You must hold a valid driving licence for the vehicle and meet any other requirements the shop sets. Follow all traffic laws, look after the vehicle and return it on time. You are responsible to the shop for damage, fines and charges as set out in your agreement with them.</p>',
        'Buying a vehicle' => '<p>Each vehicle for sale is sold by the shop that lists it. The sale contract is between you and the shop, and we are not a party to it. We don\'t own, inspect, value or guarantee these vehicles, and we don\'t collect or hold any money for them.</p><p>You pay the shop directly. Check the vehicle and its documents yourself before you pay. The shop\'s own sale terms apply to your purchase, and the shop may ask you to read and sign them when the sale is recorded.</p><p>The dispute process on this website covers bookings. If you have a problem with a vehicle you bought, speak to the shop first, then reach us through the Contact us page.</p>',
        'Shops' => '<p>If you list vehicles here, you confirm that your business details and documents are genuine and that you hold the licences and insurance the law requires. Keep your listings accurate and honour the bookings you confirm.</p><p>Shops pay for their subscription plan as shown in their account. If a plan is unpaid, access to shop features may be limited until it is paid.</p>',
        'Reviews and content' => '<p>Anything you post, such as reviews, photos and listings, must be honest, lawful and yours to share. You allow us to display it on the website. We may remove content that breaks these terms.</p>',
        'Acceptable use' => '<p>Don\'t use the website to mislead or defraud anyone, to post false listings or reviews, to harass others, or to interfere with how the website works. Don\'t try to get into accounts or data that aren\'t yours.</p>',
        'Problems and disputes' => '<p>If something goes wrong, speak to the shop first. If that doesn\'t resolve it, you can raise a dispute and our team will review it. We try to help both sides reach a fair outcome, but we aren\'t a court or an insurer, and this doesn\'t affect your legal rights.</p>',
        'Suspending accounts and listings' => '<p>We may remove a listing, or suspend or close an account, if we reasonably believe these terms have been broken, or to protect our users or the website.</p>',
        'Our liability' => '<p>We provide the website as it is and can\'t promise that it will always be available or free of errors. As far as the law allows, we aren\'t liable for the condition of any vehicle, for what shops or customers do or don\'t do, or for any rental, sale or payment between them. Nothing in these terms limits any liability that can\'t legally be limited.</p>',
        'Changes to these terms' => '<p>We may update these terms from time to time. If you keep using the website after a change, the updated terms apply to you.</p>',
        'Governing law' => '<p>These terms are governed by the laws of Sri Lanka, and the courts of Sri Lanka will deal with any legal claim about them.</p>',
        'Contact us' => '<p>If you have a question about these terms, please reach us through the Contact us page.</p>',
    ];

    private const PRIVACY = [
        'About this policy' => '<p>This policy explains what personal information we collect when you use this website, why we collect it, who can see it and the choices you have. It applies to visitors, customers and shops.</p>',
        'Information you give us' => '<p>Account details: your name, email address, phone number, password and any profile photo you add.</p><p>If you rent: your bookings, payment records and transfer receipts, your signature and the inspection records from handover, and your messages, reviews, reports and disputes.</p><p>If you run a rental shop: your business details and registration documents, bank details, staff accounts, vehicle listings and subscription payments.</p>',
        'If you buy a vehicle' => '<p>We keep your enquiries and your messages with the shop.</p><p>When a shop records a sale, it enters your name, phone number, NIC number and address, the price and how you paid, along with your signature if the shop\'s sale terms ask for one. Your NIC number is stored encrypted, and your signature is kept in private storage.</p>',
        'Information we collect automatically' => '<p>When you visit public pages we record the page, your IP address and your browser type. We use your IP address to work out your approximate location (country, city and internet provider) and timezone. We also record when you last signed in.</p>',
        'How we use your information' => '<p>We use your information to run your account, handle bookings, enquiries and disputes, verify shops, send you notifications about your account and bookings, keep the website safe, prevent fraud, understand how the website is used, and meet our legal obligations.</p>',
        'What shops can see when you rent' => '<p>When you book, the shop can see your name, phone number, email address and booking details, along with the payment and handover records for that booking. If a shop checks your licence or ID at pickup, that is between you and the shop, and we don\'t store those details.</p><p>Customers can see a shop\'s public profile, and the shop\'s bank details are shown on a confirmed booking so the customer can pay.</p>',
        'What shops can see when you buy' => '<p>When you send an enquiry, the shop can see your name, phone number, email address and your messages. The shop can see the details it recorded for your sale, and these appear on your sale agreement. We don\'t show the price a vehicle sold for, or anything about the buyer, to anyone else on the website.</p>',
        'Who else we share it with' => '<p>We don\'t sell your personal information. We share it only where needed:</p><ul><li>Service providers that help us run the website, such as hosting and email.</li><li>ip-api.com, which receives visitors\' IP addresses to work out approximate location.</li><li>OpenStreetMap, which supplies our maps and receives your IP address when a map loads.</li><li>The authorities, when the law requires it or to protect people\'s rights and safety.</li></ul><p>Links to WhatsApp and Google Maps open those services, and their own privacy policies apply there.</p>',
        'Cookies and browser storage' => '<p>We use your browser\'s storage to keep you signed in and to remember preferences, such as how you view search results. We don\'t use advertising cookies.</p>',
        'How we protect your information' => '<p>Passwords are stored in hashed form. Access to personal information is limited by role. No website can be completely secure, so please keep your password private and tell us if you think your account has been misused.</p>',
        'How long we keep it' => '<p>We keep your information while your account is active, and afterwards for as long as we need it to resolve disputes, keep business records and meet our legal obligations. Copies may remain in backups for a limited time.</p>',
        'Your choices and rights' => '<p>You can view and update your details in your account. You can also ask us for a copy of your information, ask us to correct it, or ask us to delete your account, through the Contact us page.</p><p>We may need to keep some records, such as bookings and payments, where the law requires it or a dispute is open.</p>',
        'Changes to this policy' => '<p>We may update this policy from time to time. Any changes will appear on this page.</p>',
        'Contact us' => '<p>If you have a question or request about your personal information, please reach us through the Contact us page.</p>',
    ];

    public function up(): void
    {
        Schema::create('help_items', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30)->index();
            $table->string('section', 120)->nullable();
            $table->string('title');
            $table->text('body')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $rows = [];
        $order = [];
        $add = function (string $type, ?string $section, string $title, ?string $body = null) use (&$rows, &$order) {
            $rows[] = [
                'type' => $type, 'section' => $section, 'title' => $title, 'body' => $body,
                'sort_order' => $order[$type] = isset($order[$type]) ? $order[$type] + 1 : 0, 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ];
        };

        foreach (self::SAFETY_TIPS as $section => $tips) {
            foreach ($tips as $tip) {
                $add('safety_tip', $section, $tip);
            }
        }
        foreach (self::WARNING_SIGNS as $sign) {
            $add('warning_sign', null, $sign);
        }
        foreach (self::EMERGENCY_CONTACTS as $service => $number) {
            $add('emergency_contact', null, $service, $number);
        }
        foreach (self::FAQS as $section => $questions) {
            foreach ($questions as $question => $answer) {
                $add('faq', $section, $question, $answer);
            }
        }
        foreach (self::TERMS as $title => $body) {
            $add('terms', null, $title, $body);
        }
        foreach (self::PRIVACY as $title => $body) {
            $add('privacy', null, $title, $body);
        }

        DB::table('help_items')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('help_items');
    }
};
