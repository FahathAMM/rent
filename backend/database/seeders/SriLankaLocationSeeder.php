<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\District;
use Illuminate\Database\Seeder;

/**
 * Seeds all 25 Sri Lanka districts with their divisional-secretariat-level
 * towns — platform admins can add more via platform/cities. Safe to
 * re-run: firstOrCreate() is idempotent, so running this again after
 * extending the list only inserts the new entries.
 */
class SriLankaLocationSeeder extends Seeder
{
    private const DISTRICTS = [
        'Colombo' => ['Colombo', 'Dehiwala-Mount Lavinia', 'Moratuwa', 'Sri Jayawardenepura Kotte', 'Kolonnawa', 'Kaduwela', 'Homagama', 'Maharagama', 'Kesbewa', 'Padukka', 'Avissawella', 'Ratmalana', 'Piliyandala', 'Boralesgamuwa', 'Nugegoda', 'Battaramulla', 'Wellampitiya', 'Kottawa', 'Ja-Ela'],
        'Gampaha' => ['Gampaha', 'Negombo', 'Wattala', 'Ja-Ela', 'Minuwangoda', 'Katunayake', 'Kelaniya', 'Veyangoda', 'Nittambuwa', 'Ragama', 'Divulapitiya', 'Mirigama', 'Attanagalla', 'Dompe', 'Biyagama', 'Kiribathgoda', 'Wattala', 'Seeduwa'],
        'Kalutara' => ['Kalutara', 'Panadura', 'Horana', 'Matugama', 'Beruwala', 'Aluthgama', 'Bandaragama', 'Agalawatta', 'Ingiriya', 'Bulathsinhala', 'Madurawala', 'Dodangoda', 'Palindanuwara', 'Baduraliya'],
        'Kandy' => ['Kandy', 'Katugastota', 'Gampola', 'Nawalapitiya', 'Peradeniya', 'Akurana', 'Wattegama', 'Pilimatalawa', 'Gelioya', 'Kundasale', 'Harispattuwa', 'Pathahewaheta', 'Teldeniya', 'Doluwa', 'Yatinuwara', 'Udunuwara', 'Galagedara'],
        'Matale' => ['Matale', 'Dambulla', 'Galewela', 'Ukuwela', 'Rattota', 'Pallepola', 'Naula', 'Yatawatta', 'Wilgamuwa', 'Ambanganga Korale'],
        'Nuwara Eliya' => ['Nuwara Eliya', 'Hatton', 'Talawakele', 'Ginigathhena', 'Nanu Oya', 'Ragala', 'Kotagala', 'Walapane', 'Hanguranketha', 'Ambagamuwa', 'Kotmale'],
        'Galle' => ['Galle', 'Ambalangoda', 'Hikkaduwa', 'Elpitiya', 'Baddegama', 'Karapitiya', 'Bentota', 'Habaraduwa', 'Imaduwa', 'Bope-Poddala', 'Yakkalamulla', 'Neluwa', 'Udugama', 'Thawalama', 'Nagoda'],
        'Matara' => ['Matara', 'Weligama', 'Akuressa', 'Dikwella', 'Kamburupitiya', 'Deniyaya', 'Hakmana', 'Kirinda Puhulwella', 'Devinuwara', 'Thihagoda', 'Malimbada', 'Mulatiyana', 'Pitabeddara', 'Kotapola'],
        'Hambantota' => ['Hambantota', 'Tangalle', 'Tissamaharama', 'Beliatta', 'Ambalantota', 'Walasmulla', 'Sooriyawewa', 'Weeraketiya', 'Katuwana', 'Angunakolapelessa', 'Lunugamvehera', 'Okewela'],
        'Jaffna' => ['Jaffna', 'Chavakachcheri', 'Point Pedro', 'Nallur', 'Kopay', 'Kayts', 'Velanai', 'Karainagar', 'Chankanai', 'Sandilipay', 'Tellippalai', 'Uduvil', 'Kodikamam', 'Valikamam'],
        'Kilinochchi' => ['Kilinochchi', 'Pallai', 'Paranthan', 'Poonakary', 'Karachchi'],
        'Mannar' => ['Mannar', 'Nanattan', 'Pesalai', 'Madhu', 'Musali', 'Manthai West', 'Thalaimannar'],
        'Vavuniya' => ['Vavuniya', 'Nedunkeni', 'Omanthai', 'Vavuniya South', 'Vengalacheddikulam'],
        'Mullaitivu' => ['Mullaitivu', 'Puthukkudiyiruppu', 'Oddusuddan', 'Thunukkai', 'Manthai East', 'Maritimepattu'],
        'Batticaloa' => ['Batticaloa', 'Kaluwanchikudy', 'Eravur', 'Valaichchenai', 'Kattankudy', 'Vavunathivu', 'Chenkalady', 'Koralai Pattu', 'Manmunai'],
        'Ampara' => ['Ampara', 'Kalmunai', 'Sainthamaruthu', 'Akkaraipattu', 'Dehiattakandiya', 'Addalachchenai', 'Uhana', 'Pottuvil', 'Mahaoya', 'Lahugala', 'Padiyathalawa'],
        'Trincomalee' => ['Trincomalee', 'Kinniya', 'Mutur', 'Kantalai', 'Nilaveli', 'Kuchchaveli', 'Thambalagamuwa', 'Seruvila', 'Gomarankadawala'],
        'Kurunegala' => ['Kurunegala', 'Kuliyapitiya', 'Pannala', 'Wariyapola', 'Narammala', 'Nikaweratiya', 'Polgahawela', 'Mawathagama', 'Alawwa', 'Ibbagamuwa', 'Melsiripura', 'Galgamuwa', 'Giriulla'],
        'Puttalam' => ['Puttalam', 'Chilaw', 'Wennappuwa', 'Nattandiya', 'Anamaduwa', 'Dankotuwa', 'Madampe', 'Mundalama', 'Kalpitiya', 'Nawagattegama', 'Vanathavilluwa'],
        'Anuradhapura' => ['Anuradhapura', 'Kekirawa', 'Mihintale', 'Medawachchiya', 'Thambuttegama', 'Galenbindunuwewa', 'Horowpothana', 'Nochchiyagama', 'Kebithigollewa', 'Padaviya', 'Rambewa'],
        'Polonnaruwa' => ['Polonnaruwa', 'Hingurakgoda', 'Medirigiriya', 'Kaduruwela', 'Dimbulagala', 'Lankapura', 'Elahera', 'Welikanda', 'Thamankaduwa'],
        'Badulla' => ['Badulla', 'Bandarawela', 'Haputale', 'Welimada', 'Mahiyanganaya', 'Passara', 'Hali-Ela', 'Ella', 'Uva Paranagama', 'Soranathota', 'Rideemaliyadda'],
        'Monaragala' => ['Monaragala', 'Wellawaya', 'Bibile', 'Kataragama', 'Buttala', 'Medagama', 'Siyambalanduwa', 'Thanamalwila', 'Madulla'],
        'Ratnapura' => ['Ratnapura', 'Balangoda', 'Embilipitiya', 'Pelmadulla', 'Eheliyagoda', 'Kuruwita', 'Kalawana', 'Nivitigala', 'Kolonna', 'Opanayaka', 'Godakawela', 'Ayagama'],
        'Kegalle' => ['Kegalle', 'Mawanella', 'Warakapola', 'Rambukkana', 'Deraniyagala', 'Yatiyantota', 'Ruwanwella', 'Galigamuwa', 'Dehiovita', 'Aranayaka', 'Bulathkohupitiya'],
    ];

    public function run(): void
    {
        foreach (self::DISTRICTS as $districtName => $cities) {
            $district = District::firstOrCreate(['name' => $districtName]);

            foreach (array_unique($cities) as $cityName) {
                City::firstOrCreate(['district_id' => $district->id, 'name' => $cityName]);
            }
        }
    }
}
