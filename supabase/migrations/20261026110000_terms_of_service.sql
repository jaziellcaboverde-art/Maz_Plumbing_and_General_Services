-- Terms of Service written from the project rules (phases-plan.md "Locked rules" and Phases 6 to 12).
-- Still a draft: Phase 16.4 sends it to a lawyer. Customers accept the latest published version.
insert into public.legal_versions (doc_type, version, body, published_at)
values ('terms', '1.1', $terms$Draft for the launch of MAZ. This text is based on how the platform works and is waiting for legal review before it is final.
1. About these Terms
MAZ Plumbing and General Services ("MAZ", "we") runs an online platform in Metro Manila where customers request home services such as plumbing, electrical, painting, carpentry and renovation, and approved independent providers carry them out. By creating an account or sending a booking you agree to these Terms and the Privacy Notice.
2. Accounts
You must be at least 18 years old and give true details. You are responsible for what happens under your account and for keeping your password safe. Confirm your email before you log in. We may suspend an account that gives false information or breaks these Terms.
3. Requesting a service
You choose a service, describe the job, add photos if you like, give a service address with a map pin, and choose a date or mark the job urgent where the service allows it. Services are offered in Metro Manila and nearby areas we are able to cover. Sending a request does not guarantee a provider will accept it.
4. Choosing a provider
For normal jobs we show you a ranked list of approved providers near you. The list uses distance, rating, reliability and past jobs. You pick one and we send your job to that provider, who has a limited time to accept or decline. If the provider declines or does not answer, you pick again, or you can tick the option to let us offer the job to the next best provider. For urgent jobs we offer the job to providers one by one, 15 minutes each. After three declined or unanswered offers the job goes to our admin team, who will help you.
5. Large jobs
Major renovations and other large jobs are assigned by our admin team to one foreman. You will see the foreman's profile and may ask for a change and give your reason. Admin decides.
6. Providers
Providers are independent and approved by MAZ after review of their application and identification. Providers are paid by MAZ a fixed rate per day worked, and materials are reimbursed against receipts. Providers do not collect payment from you. Do not pay a provider directly unless MAZ tells you to.
7. Quotes, deposit and payment
The provider gives a quote after accepting your job. A job is confirmed when you accept the quote and pay the deposit through the platform. The deposit is 50 percent of the quote. For minor and standard jobs the other 50 percent is due when the job is finished. For large jobs, 40 percent is paid across agreed milestones and 10 percent is held until you confirm the punch list. You may pay the balance through the platform or in cash to MAZ. Cash is recorded by MAZ staff with a reference and proof photo. Extra work needs your approval before it is done.
8. Ocular inspection
An ocular inspection, when needed, is charged separately at P1,500. It is not a cancellation fee and is not deducted from the job price.
9. Cancellation
You may cancel before a provider accepts your job at no charge. After a provider accepts, you cannot cancel in the app. Contact MAZ and our admin team will review the case. Once the provider is on the way you cannot cancel; admin may cancel only before the provider has inspected the site, for example when the customer is not present or refuses to let the provider in. For large jobs a cancellation fee covers the real costs so far, and never more than the deposit. If a provider cancels, you pay no fee. Refunds go back through the same payment method. The full Cancellation Policy will be published separately.
10. Your responsibilities
Give accurate descriptions and an address that is safe to enter, be present or arrange access at the booked time, treat providers with respect, and sign off on finished work on the screen at the end of the job. Do not use the platform to arrange work outside MAZ.
11. Messages
You can message your provider inside the platform for each booking. MAZ admin staff may read these messages to keep people safe and to settle disputes.
12. Photos and personal data
Photos you add to a booking can be seen by you, your provider and MAZ admin. We handle personal data under the Data Privacy Act and the Privacy Notice. Provider identification documents can be seen only by MAZ admin.
13. Work quality and disputes
Tell us within a reasonable time if work is not done properly. MAZ will review the booking record, photos and messages and decide how to put it right. Nothing in these Terms removes rights you have under Philippine law.
14. Changes to these Terms
We may update these Terms. The version number and date you accepted are saved. When we publish a new version we will ask you to accept it again.
15. Contact
MAZ Plumbing and General Services. Phone: 0917-327-2029, 0976-479-8534 or 0966-176-5476. Email: Mazplumbelectricalservices@gmail.com.$terms$, now())
on conflict (doc_type, version) do nothing;
